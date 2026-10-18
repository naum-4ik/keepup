-- supabase/migrations/20261027100000_push_deliveries.sql
-- Push delivery log (owner request 2026-10-18): one row per push sent, or wanted and not sent. Production
-- pushes stopped silently (no device, empty Vault) and nothing showed it.
-- Written by send-push (service role: sent / gone / failed per device, skipped 'no_device') and by the
-- database where a push can't be dispatched. Redefined from their latest definitions; only the log
-- insert is added:
--   private.dispatch_push       20261002100000_notification_prefs_push.sql (skipped 'no_device' / 'no_vault_url')
--   private.enqueue_reminders   20261024110000_template_id_recaps_reminders.sql (skipped 'no_device')
--   cron 'keepup-feed-retention' 20260930100300_feed_nudges_cheers.sql (+ 30-day delete of this log)
-- Privacy: only the push service's host is kept, never the endpoint URL or its keys.

create table public.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  notification_id uuid references public.notifications (id) on delete set null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  outcome text not null check (outcome in ('sent', 'gone', 'failed', 'skipped')),
  reason text,
  status int,
  endpoint_host text check (endpoint_host !~ '[/?#]')
);
create index push_deliveries_user_created_idx on public.push_deliveries (user_id, created_at desc);
create index push_deliveries_created_idx on public.push_deliveries (created_at);
alter table public.push_deliveries enable row level security;
create policy "push_deliveries: read own" on public.push_deliveries
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.push_deliveries from anon, authenticated;
grant select on public.push_deliveries to authenticated;
-- Append-only: the service role (send-push) inserts and reads, never rewrites. Retention runs as postgres.
grant select, insert on public.push_deliveries to service_role;
revoke update, delete, truncate on public.push_deliveries from service_role;

-- The database webhook. Unchanged except: no device, or a missing Vault URL or secret, is logged, not
-- silent. The device check moved inside the exception block so its log insert can't break the action.
create or replace function private.dispatch_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  begin
    if not exists (select 1 from public.push_subscriptions ps where ps.user_id = new.user_id) then
      insert into public.push_deliveries (notification_id, user_id, kind, outcome, reason)
      values (new.id, new.user_id, new.kind, 'skipped', 'no_device');
      return null;
    end if;
    select s.decrypted_secret into v_url from vault.decrypted_secrets s where s.name = 'send_push_url';
    select s.decrypted_secret into v_secret from vault.decrypted_secrets s where s.name = 'send_push_secret';
    if v_url is null or v_secret is null then
      insert into public.push_deliveries (notification_id, user_id, kind, outcome, reason)
      values (new.id, new.user_id, new.kind, 'skipped', 'no_vault_url');
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

-- Unchanged except the block before `return v_n`: adults whose summary hour is due but who have no
-- device get one 'skipped' row per local day (the hour-long window is checked by four runs).
create or replace function private.enqueue_reminders(p_now timestamptz)
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_user record;
  v_today date;
  v_at timestamptz;
  v_items jsonb;
  v_n int := 0;
  r record;
begin
  for v_user in
    select p.id, p.timezone, p.reminder_hour from public.profiles p
     where p.kind = 'adult' and exists (select 1 from public.push_subscriptions ps where ps.user_id = p.id)
  loop
    v_today := private.local_date(p_now, v_user.timezone);
    v_at := private.local_instant(v_today, make_time(v_user.reminder_hour, 0, 0), v_user.timezone);
    if p_now >= v_at and p_now < v_at + interval '1 hour' then
      select jsonb_build_object(
               'todo', coalesce(jsonb_agg(jsonb_build_object('title', i.title, 'template', (select h.template_id from public.habits h where h.id = i.habit_id),
                                                              'done', i.done, 'target', i.target)
                                          order by i.title, i.created_at) filter (where i.period = 'day'), '[]'::jsonb),
               'at_risk', coalesce(jsonb_agg(jsonb_build_object('title', i.title, 'template', (select h.template_id from public.habits h where h.id = i.habit_id),
                                                              'done', i.done, 'target', i.target,
                                                                'period', i.period, 'days_left', i.days_left)
                                             order by i.title, i.created_at) filter (where i.at_risk), '[]'::jsonb))
        into v_items
        from private.reminder_items(v_user.id, p_now) i
       where i.remind_at is null and (i.period = 'day' or i.at_risk);
      if jsonb_array_length(v_items -> 'todo') + jsonb_array_length(v_items -> 'at_risk') > 0 then
        -- One summary per local date in the person's current time zone. A move never sends a second
        -- one for a date (same key); a move west right after the summary can skip the next date's
        -- (its reminder hour may already have passed in the new zone). Accepted: a missed summary
        -- beats a duplicate.
        v_n := v_n + private.notify_count(array[v_user.id], 'daily_summary', 'daily_summary:' || v_today,
          null, null, null, null, null, v_items);
      end if;
    end if;
  end loop;

  -- remind_at is a wall-clock time in the person's own time zone. The habit's own day at the
  -- reminder's instant (the group's, for a group habit, as reminder_items judges it) keys the row, so
  -- one habit day gets one reminder.
  for r in
    select x.user_id, x.habit_id, x.habit_day
      from (select p.id as user_id, s.habit_id, private.habit_today(h, a.at) as habit_day
              from public.profiles p
              join public.habit_user_settings s on s.user_id = p.id and s.remind_at is not null
              join public.habits h on h.id = s.habit_id
             cross join lateral (values (private.local_date(p_now, p.timezone)), (private.local_date(p_now, p.timezone) - 1)) d(day)
             cross join lateral (select private.local_instant(d.day, s.remind_at, p.timezone) as at) a
             where p.kind = 'adult' and exists (select 1 from public.push_subscriptions ps where ps.user_id = p.id)
               and p_now >= a.at and p_now < a.at + interval '1 hour'
               and exists (select 1 from private.reminder_items(p.id, a.at) i where i.habit_id = s.habit_id and i.remind_at is not null)) x
     order by x.habit_id, x.user_id
  loop
    perform 1 from public.habits h where h.id = r.habit_id for key share;
    if not found then
      continue;
    end if;
    v_n := v_n + private.notify_count(array[r.user_id], 'habit_reminder',
      'habit_reminder:' || r.habit_id || ':' || r.habit_day, null, r.habit_id, null, null, null, '{}'::jsonb);
  end loop;

  -- Push log: due, but no device to send the summary to. Demo profiles can't have devices: not logged.
  -- created_at is p_now, so the once-per-local-day check holds for any p_now. Never blocks the reminders.
  begin
    insert into public.push_deliveries (created_at, user_id, kind, outcome, reason)
    select p_now, p.id, 'daily_summary', 'skipped', 'no_device'
      from public.profiles p
     cross join lateral (select private.local_date(p_now, p.timezone) as day) d
     cross join lateral (select private.local_instant(d.day, make_time(p.reminder_hour, 0, 0), p.timezone) as at) a
     where p.kind = 'adult' and not p.is_demo
       and not exists (select 1 from public.push_subscriptions ps where ps.user_id = p.id)
       and p_now >= a.at and p_now < a.at + interval '1 hour'
       and not exists (select 1 from public.push_deliveries pd
                        where pd.user_id = p.id and pd.kind = 'daily_summary' and pd.reason = 'no_device'
                          and pd.created_at >= private.local_instant(d.day, time '00:00', p.timezone)
                          and pd.created_at < private.local_instant(d.day + 1, time '00:00', p.timezone));
  exception when others then
    raise warning 'enqueue_reminders push log: %', sqlerrm;
  end;
  return v_n;
end;
$$;

-- Retention: the feed keeps 60 days (unchanged), this log 30. pg_cron replaces a job of the same name.
select cron.schedule('keepup-feed-retention', '23 3 * * *',
  $$delete from public.notifications where created_at < now() - interval '60 days';
    delete from public.push_deliveries where created_at < now() - interval '30 days'$$);
