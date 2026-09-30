-- M3 in-app feed (no push until M4), nudges and cheers. The feed is written by AFTER triggers on the
-- rule tables (decision 13), one row per recipient, deduplicated by dedupe_key.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'group_check_in', 'approval_needed', 'check_in_approved', 'check_in_rejected', 'everyone_done',
    'group_streak_ended', 'group_milestone', 'group_habit_created', 'group_habit_paused', 'group_habit_resumed',
    'group_habit_archived', 'member_paused', 'member_joined', 'member_left', 'role_changed', 'nudge', 'cheer',
    'kid_check_in', 'kid_streak', 'kid_goal_reached', 'kid_garden_full')),
  group_id uuid references public.groups (id) on delete cascade,
  habit_id uuid references public.habits (id) on delete cascade,
  check_in_id uuid references public.check_ins (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  subject_id uuid references public.profiles (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text unique,
  read_at timestamptz,
  seen_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;
create policy "notifications: read own" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

-- One row per recipient. A null p_dedupe means "never deduplicate" (role changes).
create function private.notify(
  p_recipients uuid[], p_kind text, p_dedupe text, p_group_id uuid, p_habit_id uuid, p_check_in_id uuid,
  p_actor_id uuid, p_subject_id uuid, p_payload jsonb)
returns void
language sql
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, group_id, habit_id, check_in_id, actor_id, subject_id, payload, dedupe_key)
  select r, p_kind, p_group_id, p_habit_id, p_check_in_id, p_actor_id, p_subject_id, coalesce(p_payload, '{}'::jsonb),
         p_dedupe || ':' || r
    from unnest(p_recipients) r
   where r is not null
  on conflict (dedupe_key) do nothing;
$$;

-- Current adult members of a group, minus some people (null entries are ignored).
create function private.group_adults(p_group_id uuid, p_except uuid[])
returns uuid[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(m.user_id), '{}')
    from public.group_members m
   where m.group_id = p_group_id and m.left_at is null
     and not (m.user_id = any (array_remove(coalesce(p_except, '{}'), null)));
$$;

create function private.group_admins(p_group_id uuid, p_except uuid[])
returns uuid[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(m.user_id), '{}')
    from public.group_members m
   where m.group_id = p_group_id and m.left_at is null and m.role = 'admin'
     and not (m.user_id = any (array_remove(coalesce(p_except, '{}'), null)));
$$;

-- Consecutive done periods before p_period_start, from finalized results (skipped passes over,
-- missed stops), the same way streaks count.
create function private.run_before(p_habit public.habits, p_period_start date)
returns int
language plpgsql
stable
set search_path = ''
as $$
declare
  v_run int := 0;
  r record;
begin
  for r in select x.outcome from public.period_results x
            where x.habit_id = p_habit.id and x.period_start < p_period_start
            order by x.period_start desc loop
    exit when r.outcome = 'missed';
    if r.outcome = 'done' then
      v_run := v_run + 1;
    end if;
  end loop;
  return v_run;
end;
$$;

-- The streak milestone schedule (ideas/achievements-and-rewards.md §2).
create function private.is_streak_milestone(p_period public.habit_period, p_n int)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_period
    when 'day' then p_n = any (array[1, 2, 5, 7, 10, 14, 30, 50, 100, 200, 365])
    when 'week' then p_n = any (array[1, 2, 4, 8, 12, 26, 52])
    when 'month' then p_n = any (array[1, 3, 6, 12])
  end;
$$;

-- "Everyone did it" for one group period, once per member.
create function private.feed_everyone_done(p_habit public.habits, p_period_start date)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_habit.group_id is null then
    return;
  end if;
  -- Serialize on the habit row: review_check_in_impl locks only the check-in, so two concurrent
  -- final approvals (or a kid's auto-approved check-in landing during a final review) could each
  -- see the other's row as pending and nobody would get "Everyone did it". Taking the habit lock
  -- keeps the check-in -> habit order (check_in_impl already holds it), so no deadlock.
  perform 1 from public.habits where id = p_habit.id for update;
  if private.period_outcome(p_habit, p_period_start) = 'done' then
    perform private.notify(private.group_adults(p_habit.group_id, null), 'everyone_done',
      'everyone_done:' || p_habit.id || ':' || p_period_start, p_habit.group_id, p_habit.id, null, null, null,
      jsonb_build_object('period_start', p_period_start));
  end if;
end;
$$;

-- Check-ins: #1 group check-in, #2 approval needed, kid routine check-ins (feed only), #10.
create function private.feed_on_check_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_habit public.habits;
  v_kind text;
  v_group uuid;
begin
  select h.* into v_habit from public.habits h where h.id = new.habit_id;
  select p.kind into v_kind from public.profiles p where p.id = new.user_id;
  v_group := coalesce(v_habit.group_id, private.child_group(v_habit.owner_id));
  if v_group is null then
    return new; -- an adult's private habit
  end if;

  if v_kind = 'child' then
    perform private.notify(private.group_adults(v_group, array[new.logged_by]), 'kid_check_in', 'kid_check_in:' || new.id,
      v_group, new.habit_id, new.id, new.logged_by, new.user_id, '{}'::jsonb);
  elsif new.status = 'pending' then
    perform private.notify(private.group_adults(v_group, array[new.user_id]), 'approval_needed', 'approval_needed:' || new.id,
      v_group, new.habit_id, new.id, new.user_id, null, '{}'::jsonb);
  else
    perform private.notify(
      array(select r from unnest(private.group_adults(v_group, array[new.user_id])) r
             where not private.is_member_frozen(new.habit_id, r, new.local_date, new.local_date + 1)),
      'group_check_in', 'group_check_in:' || new.id, v_group, new.habit_id, new.id, new.user_id, null, '{}'::jsonb);
  end if;

  if new.status = 'approved' then
    perform private.feed_everyone_done(v_habit, new.period_start);
  end if;
  return new;
end;
$$;

-- Reviews: #5 approved (feed), #4 not approved, and #10 when the approval completes the group.
create function private.feed_on_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_habit public.habits;
begin
  if old.status <> 'pending' or new.status not in ('approved', 'rejected') then
    return new;
  end if;
  select h.* into v_habit from public.habits h where h.id = new.habit_id;
  perform private.notify(array[new.user_id],
    case new.status when 'approved' then 'check_in_approved' else 'check_in_rejected' end,
    'review:' || new.id, v_habit.group_id, new.habit_id, new.id, new.reviewed_by, null, '{}'::jsonb);
  if new.status = 'approved' then
    perform private.feed_everyone_done(v_habit, new.period_start);
  end if;
  return new;
end;
$$;

create trigger check_ins_feed_insert after insert on public.check_ins
  for each row execute function private.feed_on_check_in();
create trigger check_ins_feed_review after update of status on public.check_ins
  for each row execute function private.feed_on_review();

-- Habits: #12 created, #18 archived.
create function private.feed_on_habit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.group_id is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    perform private.notify(private.group_adults(new.group_id, array[new.created_by]), 'group_habit_created',
      'group_habit_created:' || new.id, new.group_id, new.id, null, new.created_by, null,
      jsonb_build_object('period', new.period, 'target_count', new.target_count));
  elsif old.archived_at is null and new.archived_at is not null then
    perform private.notify(private.group_adults(new.group_id, array[auth.uid()]), 'group_habit_archived',
      'group_habit_archived:' || new.id, new.group_id, new.id, null, auth.uid(), null, '{}'::jsonb);
  end if;
  return new;
end;
$$;

create trigger habits_feed after insert or update of archived_at on public.habits
  for each row execute function private.feed_on_habit();

-- Pauses: #13 paused / resumed (whole habit), #14 member paused (feed only).
create function private.feed_on_freeze()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.habit_freezes := case when tg_op = 'DELETE' then old else new end;
  v_habit public.habits;
begin
  -- A cascade (habit or group deleted) finds no habit: write nothing.
  select h.* into v_habit from public.habits h where h.id = v_row.habit_id;
  if not found or v_habit.group_id is null then
    return v_row;
  end if;

  if tg_op = 'INSERT' and new.user_id is null then
    perform private.notify(private.group_adults(v_habit.group_id, array[new.created_by]), 'group_habit_paused',
      'group_habit_paused:' || new.id, v_habit.group_id, v_habit.id, null, new.created_by, null,
      jsonb_build_object('starts_on', new.starts_on, 'ends_on', new.ends_on));
  elsif tg_op = 'INSERT' then
    if (select p.kind from public.profiles p where p.id = new.user_id) = 'adult' then
      perform private.notify(private.group_adults(v_habit.group_id, array[new.user_id]), 'member_paused',
        'member_paused:' || new.id, v_habit.group_id, v_habit.id, null, new.user_id, null, '{}'::jsonb);
    end if;
  elsif v_row.user_id is null then
    perform private.notify(private.group_adults(v_habit.group_id, array[auth.uid()]), 'group_habit_resumed',
      'group_habit_resumed:' || v_habit.id || ':' || private.habit_today(v_habit, now()), v_habit.group_id, v_habit.id,
      null, auth.uid(), null, '{}'::jsonb);
  end if;
  return v_row;
end;
$$;

create trigger habit_freezes_feed after insert or update of ends_on or delete on public.habit_freezes
  for each row execute function private.feed_on_freeze();

-- Members: #15 joined, #16 left or removed (admins), #17 role changed.
create function private.feed_on_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or (old.left_at is not null and new.left_at is null) then
    perform private.notify(private.group_adults(new.group_id, array[new.user_id]), 'member_joined',
      'member_joined:' || new.group_id || ':' || new.user_id || ':' || extract(epoch from new.joined_at)::bigint,
      new.group_id, null, null, new.user_id, null, '{}'::jsonb);
  elsif old.left_at is null and new.left_at is not null then
    perform private.notify(private.group_admins(new.group_id, array[new.user_id, auth.uid()]), 'member_left',
      'member_left:' || new.group_id || ':' || new.user_id || ':' || extract(epoch from new.left_at)::bigint,
      new.group_id, null, null, new.user_id, null,
      jsonb_build_object('removed', auth.uid() is distinct from new.user_id));
  elsif old.role <> new.role then
    perform private.notify(array[new.user_id], 'role_changed', null, new.group_id, null, null, auth.uid(), null,
      jsonb_build_object('role', new.role));
  end if;
  return new;
end;
$$;

create trigger group_members_feed after insert or update of left_at, role on public.group_members
  for each row execute function private.feed_on_member();

-- Finalized periods: #9 group streak ended, group milestones, kid streak milestones (≥ 7 days).
create function private.feed_on_period_result()
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
  if v_child_group is not null and new.outcome = 'done' and v_habit.period = 'day' then
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

create trigger period_results_feed after insert on public.period_results
  for each row execute function private.feed_on_period_result();

-- Nudges (spec: Nudges and cheers; ideas/notifications-tone.md: three presets, no free text).
create table public.nudges (
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  local_date date not null,
  kind text not null check (kind in ('thinking_of_you', 'you_got_this', 'gentle_reminder')),
  created_at timestamptz not null default now(),
  primary key (sender_id, recipient_id, habit_id, local_date)
);

alter table public.nudges enable row level security;
create policy "nudges: read own" on public.nudges
  for select to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));
revoke all on public.nudges from anon, authenticated;
grant select on public.nudges to authenticated;

create function private.nudge_impl(p_sender uuid, p_habit_id uuid, p_recipient uuid, p_kind text, p_now timestamptz)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_habit public.habits;
  v_today date;
  v_start date;
begin
  select h.* into v_habit from public.habits h where h.id = p_habit_id and h.archived_at is null;
  if not found or v_habit.group_id is null or not private.is_member(v_habit.group_id, p_sender) then
    raise exception 'keepup:habit_not_found' using errcode = 'P0002';
  end if;
  v_today := private.habit_today(v_habit, p_now);
  v_start := private.habit_period_start(v_habit, v_today);

  if p_recipient = p_sender
     or not private.is_member(v_habit.group_id, p_recipient)
     or not (p_recipient in (select private.required_members(v_habit, v_start)))
     or private.is_frozen(p_habit_id, v_today, v_today + 1)
     or private.is_member_frozen(p_habit_id, p_recipient, v_today, v_today + 1)
     or (select count(*) from public.check_ins c
          where c.habit_id = p_habit_id and c.user_id = p_recipient and c.period_start = v_start
            and c.status in ('approved', 'pending')) >= v_habit.target_count
     or exists (select 1 from public.check_ins c
                 where c.habit_id = p_habit_id and c.user_id = p_recipient and c.local_date = v_today
                   and c.status <> 'rejected') then
    raise exception 'keepup:cannot_nudge' using errcode = 'P0001';
  end if;

  insert into public.nudges (sender_id, recipient_id, habit_id, local_date, kind, created_at)
  values (p_sender, p_recipient, p_habit_id, v_today, p_kind, p_now)
  on conflict do nothing;
  if not found then
    raise exception 'keepup:already_nudged' using errcode = 'P0001';
  end if;

  perform private.notify(array[p_recipient], 'nudge', 'nudge:' || p_sender || ':' || p_habit_id || ':' || v_today,
    v_habit.group_id, p_habit_id, null, p_sender, null, jsonb_build_object('kind', p_kind));
end;
$$;

-- Cheers: another member's counted check-in on a group habit, once each (adults only, decision 9).
create table public.cheers (
  check_in_id uuid not null references public.check_ins (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (check_in_id, user_id)
);

alter table public.cheers enable row level security;
create policy "cheers: read shared" on public.cheers
  for select to authenticated
  using (exists (select 1 from public.check_ins c where c.id = check_in_id and public.can_read_habit(c.habit_id)));
revoke all on public.cheers from anon, authenticated;
grant select on public.cheers to authenticated;

create function private.cheer_impl(p_user uuid, p_check_in_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_check_in public.check_ins;
  v_habit public.habits;
begin
  select c.* into v_check_in from public.check_ins c where c.id = p_check_in_id;
  if not found then
    raise exception 'keepup:check_in_not_found' using errcode = 'P0002';
  end if;
  select h.* into v_habit from public.habits h where h.id = v_check_in.habit_id;
  if v_habit.group_id is null or not private.is_member(v_habit.group_id, p_user) then
    raise exception 'keepup:check_in_not_found' using errcode = 'P0002';
  end if;
  if v_check_in.user_id = p_user or v_check_in.status <> 'approved'
     or (select p.kind from public.profiles p where p.id = v_check_in.user_id) <> 'adult' then
    raise exception 'keepup:cannot_cheer' using errcode = 'P0001';
  end if;

  insert into public.cheers (check_in_id, user_id) values (p_check_in_id, p_user) on conflict do nothing;
  if not found then
    return; -- already cheered; a repeat must not notify again, even after the feed purge
  end if;
  perform private.notify(array[v_check_in.user_id], 'cheer', 'cheer:' || p_check_in_id || ':' || p_user,
    v_habit.group_id, v_habit.id, p_check_in_id, p_user, null, '{}'::jsonb);
end;
$$;

-- The Inbox. Names are joined here (decision 9): the recipient sees who did what in their groups.
create function private.inbox_feed_impl(p_user uuid, p_limit int)
returns table (
  id uuid, kind text, created_at timestamptz, read_at timestamptz, seen_at timestamptz,
  group_id uuid, group_name text, habit_id uuid, habit_title text, habit_emoji text, check_in_id uuid,
  actor_name text, subject_id uuid, subject_name text, subject_avatar_emoji text, payload jsonb)
language sql
stable
set search_path = ''
as $$
  select n.id, n.kind, n.created_at, n.read_at, n.seen_at, n.group_id, g.name, n.habit_id, h.title, h.emoji, n.check_in_id,
         a.display_name, n.subject_id, s.display_name, s.avatar_emoji, n.payload
    from public.notifications n
    left join public.groups g on g.id = n.group_id
    left join public.habits h on h.id = n.habit_id
    left join public.profiles a on a.id = n.actor_id
    left join public.profiles s on s.id = n.subject_id
   where n.user_id = p_user
   order by n.created_at desc
   limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

create function private.pending_approvals_impl(p_user uuid, p_now timestamptz)
returns table (
  check_in_id uuid, habit_id uuid, habit_title text, habit_emoji text, group_id uuid, group_name text,
  author_id uuid, author_name text, author_avatar_emoji text, author_avatar_color text,
  local_date date, created_at timestamptz, review_deadline timestamptz)
language sql
stable
set search_path = ''
as $$
  select c.id, h.id, h.title, h.emoji, g.id, g.name, p.id, p.display_name, p.avatar_emoji, p.avatar_color,
         c.local_date, c.created_at, private.review_deadline(h, c.period_start)
    from public.check_ins c
    join public.habits h on h.id = c.habit_id
    join public.groups g on g.id = h.group_id
    join public.profiles p on p.id = c.user_id
   where c.status = 'pending'
     and c.user_id <> p_user
     and private.is_member(h.group_id, p_user)
     and p_now < private.review_deadline(h, c.period_start)
   order by c.created_at;
$$;

create function public.nudge(p_habit_id uuid, p_recipient_id uuid, p_kind text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  perform private.nudge_impl(auth.uid(), p_habit_id, p_recipient_id, p_kind, now());
end;
$$;

create function public.cheer(p_check_in_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  perform private.cheer_impl(auth.uid(), p_check_in_id);
end;
$$;

create function public.inbox_feed(p_limit int default 50)
returns table (
  id uuid, kind text, created_at timestamptz, read_at timestamptz, seen_at timestamptz,
  group_id uuid, group_name text, habit_id uuid, habit_title text, habit_emoji text, check_in_id uuid,
  actor_name text, subject_id uuid, subject_name text, subject_avatar_emoji text, payload jsonb)
language sql stable security definer set search_path = '' as $$
  select * from private.inbox_feed_impl(auth.uid(), p_limit);
$$;

create function public.pending_approvals()
returns table (
  check_in_id uuid, habit_id uuid, habit_title text, habit_emoji text, group_id uuid, group_name text,
  author_id uuid, author_name text, author_avatar_emoji text, author_avatar_color text,
  local_date date, created_at timestamptz, review_deadline timestamptz)
language sql stable security definer set search_path = '' as $$
  select * from private.pending_approvals_impl(auth.uid(), now());
$$;

-- null ids = everything.
create function public.mark_feed_read(p_ids uuid[] default null)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_n int;
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  update public.notifications set read_at = now()
   where user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Celebrations (Everyone did it, milestone cards) are shown once: seen_at, separate from read_at.
create function public.mark_feed_seen(p_ids uuid[])
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_n int;
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  update public.notifications set seen_at = now()
   where user_id = auth.uid() and seen_at is null and id = any (coalesce(p_ids, '{}'));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke execute on function
  public.nudge(uuid, uuid, text), public.cheer(uuid), public.inbox_feed(int), public.pending_approvals(),
  public.mark_feed_read(uuid[]), public.mark_feed_seen(uuid[])
  from public, anon;
grant execute on function
  public.nudge(uuid, uuid, text), public.cheer(uuid), public.inbox_feed(int), public.pending_approvals(),
  public.mark_feed_read(uuid[]), public.mark_feed_seen(uuid[])
  to authenticated;

-- The feed keeps 60 days (spec: Channels; privacy policy).
select cron.schedule('keepup-feed-retention', '23 3 * * *',
  $$delete from public.notifications where created_at < now() - interval '60 days'$$);

-- Live updates on Today, the habit page and the Inbox (spec: Data access). Realtime applies RLS.
-- Re-runnable and safe where the publication is missing or FOR ALL TABLES.
do $$
declare
  v_table text;
begin
  foreach v_table in array array['check_ins', 'notifications'] loop
    if exists (select 1 from pg_catalog.pg_publication p where p.pubname = 'supabase_realtime' and not p.puballtables)
       and not exists (select 1 from pg_catalog.pg_publication_tables t
                        where t.pubname = 'supabase_realtime' and t.schemaname = 'public' and t.tablename = v_table) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$$;
