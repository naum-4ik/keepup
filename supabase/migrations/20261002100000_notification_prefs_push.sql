-- supabase/migrations/20261002100000_notification_prefs_push.sql
-- M4 notification preferences and push (spec: Notifications → Pipeline, Mute controls; Data model).
-- The database decides whether a feed row is pushed; send-push only delivers (decision 0016).

create extension if not exists pg_net with schema extensions;

-- 1. Every M4 kind at once, so later PRs don't touch the constraint. The app skips kinds it doesn't
-- know yet (lib/feed-copy.ts FEED_KINDS).
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'group_check_in', 'approval_needed', 'check_in_approved', 'check_in_rejected', 'everyone_done',
  'group_streak_ended', 'group_milestone', 'group_habit_created', 'group_habit_paused', 'group_habit_resumed',
  'group_habit_archived', 'member_paused', 'member_joined', 'member_left', 'role_changed', 'nudge', 'cheer',
  'kid_check_in', 'kid_streak', 'kid_goal_reached', 'kid_garden_full',
  'private_streak_ended', 'daily_summary', 'habit_reminder', 'approval_expiring', 'streak_back',
  'already_logged', 'sync_dropped', 'undo_dropped'));

alter table public.notifications
  add column category text check (category in ('always', 'reminders', 'group_activity', 'approvals', 'nudges', 'group_updates', 'achievements')),
  add column push boolean not null default false,
  add column pushed_at timestamptz;

-- 2. Pause all (1h / 8h / until tomorrow / until turned back on = infinity). Written by an RPC only.
alter table public.profiles add column muted_until timestamptz;

-- 3. Category toggles. A missing row means enabled.
create table public.notification_prefs (
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('reminders', 'group_activity', 'approvals', 'nudges', 'group_updates', 'achievements')),
  enabled boolean not null,
  primary key (user_id, category)
);
alter table public.notification_prefs enable row level security;
create policy "notification_prefs: read own" on public.notification_prefs
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.notification_prefs from anon, authenticated;
grant select on public.notification_prefs to authenticated;

-- 4. Per person, per habit: mute, reminders on/off, and an optional own time (ideas/notifications-tone.md).
-- remind_at is in the person's own time zone.
create table public.habit_user_settings (
  user_id uuid not null references public.profiles (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  muted boolean not null default false,
  reminders boolean not null default true,
  remind_at time,
  primary key (user_id, habit_id)
);
create index habit_user_settings_habit_idx on public.habit_user_settings (habit_id);
alter table public.habit_user_settings enable row level security;
create policy "habit_user_settings: read own" on public.habit_user_settings
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.habit_user_settings from anon, authenticated;
grant select on public.habit_user_settings to authenticated;

-- 5. One row per device (endpoint). A phone shared by two accounts belongs to whoever subscribed last.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 1 and 200),
  auth text not null check (char_length(auth) between 1 and 100),
  user_agent text check (char_length(user_agent) <= 300),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy "push_subscriptions: read own" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon, authenticated;
grant select on public.push_subscriptions to authenticated;

-- 6. Which kinds push, and under which category (spec: Events). null = feed only; 'always' = no
-- category toggle. Switched on in steps: here nudges and "not approved"; PR 6 reminders; PR 8 group events.
create function private.push_category(p_kind text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'nudge' then 'nudges'
    when 'check_in_rejected' then 'always'
  end;
$$;

-- Precedence: pause all → habit mute → per-habit reminders → category toggles. Adults only (children
-- have no devices). p_group_id and p_payload are for per-event rules (PR 8).
create function private.push_allowed(
  p_user uuid, p_kind text, p_habit_id uuid, p_group_id uuid, p_payload jsonb, p_now timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select c.category is not null
       and p.kind = 'adult'
       and (p.muted_until is null or p.muted_until <= p_now)
       and not coalesce(s.muted, false)
       and not (c.category = 'reminders' and p_habit_id is not null and not coalesce(s.reminders, true))
       and (c.category = 'always' or coalesce(np.enabled, true))
      from (select private.push_category(p_kind) as category) c
      join public.profiles p on p.id = p_user
      left join public.habit_user_settings s on s.user_id = p_user and s.habit_id = p_habit_id
      left join public.notification_prefs np on np.user_id = p_user and np.category = c.category), false);
$$;

-- Every feed row gets its flag on the way in, whichever trigger or job wrote it (decision 0014).
create function private.notification_push_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.category := private.push_category(new.kind);
  new.push := private.push_allowed(new.user_id, new.kind, new.habit_id, new.group_id, new.payload, new.created_at);
  return new;
end;
$$;

create trigger notifications_push_flag before insert on public.notifications
  for each row execute function private.notification_push_flag();

-- The database webhook (spec: Pipeline step 2). URL and secret come from Vault, set per environment;
-- where they're missing (local, CI) nothing is called. pg_net sends only after commit. Only for
-- people with a device. A failing push never blocks the action: any error here (a malformed URL in
-- Vault, pg_net missing) is a warning, and the feed row and the action that wrote it still commit.
create function private.dispatch_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.push_subscriptions ps where ps.user_id = new.user_id) then
    return null;
  end if;
  begin
    select s.decrypted_secret into v_url from vault.decrypted_secrets s where s.name = 'send_push_url';
    select s.decrypted_secret into v_secret from vault.decrypted_secrets s where s.name = 'send_push_secret';
    if v_url is null or v_secret is null then
      return null;
    end if;
    perform net.http_post(
      url := v_url,
      body := jsonb_build_object('id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-keepup-push-secret', v_secret),
      timeout_milliseconds := 5000);
  exception when others then
    raise warning 'dispatch_push: %', sqlerrm;
  end;
  return null;
end;
$$;

create trigger notifications_push_dispatch after insert on public.notifications
  for each row when (new.push) execute function private.dispatch_push();

-- 7. What send-push needs for one row, built from current state at send time (spec: Coalescing):
-- names of everyone whose check-in on this habit and day reached this person, and the approvals
-- still waiting for them at p_now. null when the row isn't a push.
create function public.push_job(p_id uuid, p_now timestamptz default now())
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', n.id, 'kind', n.kind, 'user_id', n.user_id, 'pushed', n.pushed_at is not null,
    'group_id', n.group_id, 'group', g.name, 'habit_id', n.habit_id, 'habit', h.title, 'period', h.period,
    'target', h.target_count, 'check_in_id', n.check_in_id, 'check_in_status', c.status,
    'actor', a.display_name, 'subject_id', n.subject_id, 'subject', s.display_name, 'payload', n.payload,
    'names', case when n.kind = 'group_check_in' then (
      select coalesce(jsonb_agg(x.name order by x.first), '[]'::jsonb)
        from (select ap.display_name as name, min(o.created_at) as first
                from public.notifications o
                join public.check_ins oc on oc.id = o.check_in_id
                join public.profiles ap on ap.id = o.actor_id
               where o.user_id = n.user_id and o.kind = 'group_check_in' and o.habit_id = n.habit_id
                 and oc.local_date = c.local_date
               group by ap.id, ap.display_name) x)
      else '[]'::jsonb end,
    'pending', case when n.kind in ('approval_needed', 'approval_expiring') then (
      select coalesce(jsonb_agg(jsonb_build_object('check_in_id', pa.check_in_id, 'author', pa.author_name, 'habit', pa.habit_title)
                                order by pa.created_at), '[]'::jsonb)
        from private.pending_approvals_impl(n.user_id, p_now) pa)
      else '[]'::jsonb end,
    'subscriptions', (
      select coalesce(jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth', ps.auth)), '[]'::jsonb)
        from public.push_subscriptions ps where ps.user_id = n.user_id))
    from public.notifications n
    left join public.groups g on g.id = n.group_id
    left join public.habits h on h.id = n.habit_id
    left join public.check_ins c on c.id = n.check_in_id
    left join public.profiles a on a.id = n.actor_id
    left join public.profiles s on s.id = n.subject_id
   where n.id = p_id and n.push;
$$;

-- Spec: Pipeline step 3. Marks the row sent and deletes the endpoints the push service called gone
-- (404/410), only among the recipient's own devices.
create function public.push_done(p_id uuid, p_dead_endpoints text[])
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions ps
   where ps.endpoint = any (coalesce(p_dead_endpoints, '{}'))
     and ps.user_id = (select n.user_id from public.notifications n where n.id = p_id);
  update public.notifications set pushed_at = now() where id = p_id and pushed_at is null;
$$;

revoke execute on function public.push_job(uuid, timestamptz), public.push_done(uuid, text[]) from public, anon, authenticated;
grant execute on function public.push_job(uuid, timestamptz), public.push_done(uuid, text[]) to service_role;

-- 8. Settings the app writes (rules here, p_now pinned in tests).
create function private.set_notification_pref_impl(p_user uuid, p_category text, p_enabled boolean)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_category is null or p_category not in ('reminders', 'group_activity', 'approvals', 'nudges', 'group_updates', 'achievements') then
    raise exception 'keepup:invalid_category' using errcode = 'P0001';
  end if;
  insert into public.notification_prefs (user_id, category, enabled) values (p_user, p_category, coalesce(p_enabled, true))
  on conflict (user_id, category) do update set enabled = excluded.enabled;
end;
$$;

create function private.pause_notifications_impl(p_user uuid, p_choice text, p_now timestamptz)
returns timestamptz
language plpgsql
set search_path = ''
as $$
declare
  v_tz text;
  v_until timestamptz;
begin
  if p_choice is null or p_choice not in ('1h', '8h', 'tomorrow', 'until_on', 'resume') then
    raise exception 'keepup:invalid_choice' using errcode = 'P0001';
  end if;
  select p.timezone into v_tz from public.profiles p where p.id = p_user;
  v_until := case p_choice
    when '1h' then p_now + interval '1 hour'
    when '8h' then p_now + interval '8 hours'
    when 'tomorrow' then private.local_midnight(private.local_date(p_now, v_tz) + 1, v_tz)
    when 'until_on' then 'infinity'::timestamptz
    else null
  end;
  update public.profiles set muted_until = v_until where id = p_user;
  return v_until;
end;
$$;

-- Only someone who takes part in the habit (its owner, or an adult of its group) has settings for it.
create function private.habit_for_settings(p_user uuid, p_habit_id uuid)
returns public.habits
language plpgsql
stable
set search_path = ''
as $$
declare
  v_habit public.habits;
begin
  select h.* into v_habit from public.habits h where h.id = p_habit_id;
  if not found or not private.takes_part(v_habit, p_user) then
    raise exception 'keepup:habit_not_found' using errcode = 'P0002';
  end if;
  return v_habit;
end;
$$;

create function private.set_habit_mute_impl(p_user uuid, p_habit_id uuid, p_muted boolean)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.habit_for_settings(p_user, p_habit_id);
  insert into public.habit_user_settings (user_id, habit_id, muted) values (p_user, p_habit_id, coalesce(p_muted, false))
  on conflict (user_id, habit_id) do update set muted = excluded.muted;
end;
$$;

-- 'summary': in the daily summary (default); 'time': its own push at p_remind_at, out of the summary;
-- 'off': no reminders for this habit.
create function private.set_habit_reminder_impl(p_user uuid, p_habit_id uuid, p_mode text, p_remind_at time)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_mode is null or p_mode not in ('summary', 'time', 'off') or (p_mode = 'time' and p_remind_at is null) then
    raise exception 'keepup:invalid_choice' using errcode = 'P0001';
  end if;
  perform private.habit_for_settings(p_user, p_habit_id);
  insert into public.habit_user_settings (user_id, habit_id, reminders, remind_at)
  values (p_user, p_habit_id, p_mode <> 'off', case when p_mode = 'time' then p_remind_at end)
  on conflict (user_id, habit_id) do update set reminders = excluded.reminders, remind_at = excluded.remind_at;
end;
$$;

create function private.save_push_subscription_impl(p_user uuid, p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_endpoint is null or p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000
     or coalesce(char_length(p_p256dh), 0) not between 1 and 200 or coalesce(char_length(p_auth), 0) not between 1 and 100 then
    raise exception 'keepup:invalid_subscription' using errcode = 'P0001';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (p_user, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
end;
$$;

create function public.set_notification_pref(p_category text, p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  perform private.set_notification_pref_impl(auth.uid(), p_category, p_enabled);
end;
$$;

create function public.pause_notifications(p_choice text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return private.pause_notifications_impl(auth.uid(), p_choice, now());
end;
$$;

create function public.set_habit_mute(p_habit_id uuid, p_muted boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  perform private.set_habit_mute_impl(auth.uid(), p_habit_id, p_muted);
end;
$$;

create function public.set_habit_reminder(p_habit_id uuid, p_mode text, p_remind_at time default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  perform private.set_habit_reminder_impl(auth.uid(), p_habit_id, p_mode, p_remind_at);
end;
$$;

create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  perform private.save_push_subscription_impl(auth.uid(), p_endpoint, p_p256dh, p_auth, p_user_agent);
end;
$$;

create function public.delete_push_subscription(p_endpoint text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
end;
$$;

revoke execute on function
  public.set_notification_pref(text, boolean), public.pause_notifications(text), public.set_habit_mute(uuid, boolean),
  public.set_habit_reminder(uuid, text, time), public.save_push_subscription(text, text, text, text),
  public.delete_push_subscription(text)
  from public, anon;
grant execute on function
  public.set_notification_pref(text, boolean), public.pause_notifications(text), public.set_habit_mute(uuid, boolean),
  public.set_habit_reminder(uuid, text, time), public.save_push_subscription(text, text, text, text),
  public.delete_push_subscription(text)
  to authenticated;

-- 9. #11 Private streak ended (feed only). Copied from 20260930100300_feed_nudges_cheers.sql; only the
-- branch for an adult's private habit is new. A child's own habit keeps its kid-streak branch.
create or replace function private.feed_on_period_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_habit public.habits;
  v_run int;
  v_child_group uuid;
begin
  select h.* into v_habit from public.habits h where h.id = new.habit_id;
  if not found then
    return new;
  end if;

  if v_habit.group_id is not null then
    if new.outcome = 'missed' then
      v_run := private.run_before(v_habit, new.period_start);
      if v_run > 0 then
        perform private.notify(private.group_adults(v_habit.group_id, null), 'group_streak_ended',
          'group_streak_ended:' || v_habit.id || ':' || new.period_start, v_habit.group_id, v_habit.id, null, null, null,
          jsonb_build_object('streak', v_run, 'period', v_habit.period));
      end if;
    elsif new.outcome = 'done' then
      v_run := private.run_before(v_habit, new.period_start) + 1;
      if private.is_streak_milestone(v_habit.period, v_run) then
        perform private.notify(private.group_adults(v_habit.group_id, null), 'group_milestone',
          'group_milestone:' || v_habit.id || ':' || new.period_start, v_habit.group_id, v_habit.id, null, null, null,
          jsonb_build_object('streak', v_run, 'period', v_habit.period));
      end if;
    end if;
    return new;
  end if;

  v_child_group := private.child_group(v_habit.owner_id);
  if v_child_group is null then
    if new.outcome = 'missed' then
      v_run := private.run_before(v_habit, new.period_start);
      if v_run > 0 then
        perform private.notify(array[v_habit.owner_id], 'private_streak_ended',
          'private_streak_ended:' || v_habit.id || ':' || new.period_start, null, v_habit.id, null, null, null,
          jsonb_build_object('streak', v_run, 'period', v_habit.period,
            'best', (select s.best_streak from private.habit_streaks(v_habit.id, new.finalized_at) s)));
      end if;
    end if;
    return new;
  end if;

  if new.outcome = 'done' and v_habit.period = 'day' then
    v_run := private.run_before(v_habit, new.period_start) + 1;
    if v_run >= 7 and private.is_streak_milestone('day', v_run) then
      perform private.notify(private.group_adults(v_child_group, null), 'kid_streak',
        'kid_streak:' || v_habit.id || ':' || new.period_start, v_child_group, v_habit.id, null, null, v_habit.owner_id,
        jsonb_build_object('streak', v_run));
    end if;
  end if;
  return new;
end;
$$;
