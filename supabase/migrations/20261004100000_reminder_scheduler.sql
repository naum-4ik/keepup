-- supabase/migrations/20261004100000_reminder_scheduler.sql
-- The reminder scheduler (spec: Pipeline step 4, Daily reminder content; ideas/notifications-tone.md).
--
-- Lock order (see 20261001100000_db_hardening.sql): habit rows (ascending id) → check-in rows, with
-- the group row after the habits. A feed insert takes FOR KEY SHARE on every row it references
-- (profile, group, habit, check-in) in an order the caller doesn't control, so each job below that
-- writes rows referencing a habit locks the habit itself first, in habit id order.
-- keepup-finalize-periods runs at the same minutes and locks habits FOR UPDATE in id order, and
-- deleting a group locks its habits before the group row, so they wait for these jobs (or the other
-- way round) instead of deadlocking. Each job runs in its own cron transaction.

-- 1. Copied from 20261002100000_notification_prefs_push.sql; reminders and "approval expiring" join.
create or replace function private.push_category(p_kind text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'nudge' then 'nudges'
    when 'check_in_rejected' then 'always'
    when 'daily_summary' then 'reminders'
    when 'habit_reminder' then 'reminders'
    when 'approval_expiring' then 'approvals'
  end;
$$;

-- 2. Own reminder times are on the quarter hour, the scheduler's tick (00, 15, 30, 45), so each
-- one has a tick at its exact time. Earlier values are rounded down to their quarter.
update public.habit_user_settings
   set remind_at = make_time(extract(hour from remind_at)::int, (extract(minute from remind_at)::int / 15) * 15, 0)
 where remind_at is not null
   and (extract(minute from remind_at)::int % 15 <> 0 or extract(second from remind_at) <> 0);

create function private.is_quarter_hour(p_time time)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select extract(minute from p_time)::int % 15 = 0 and extract(second from p_time) = 0;
$$;

alter table public.habit_user_settings
  add constraint habit_user_settings_remind_at_quarter_check check (remind_at is null or private.is_quarter_hour(remind_at));

-- Copied from 20261002100000_notification_prefs_push.sql; only the invalid_time check is new.
-- 'summary': in the daily summary (default); 'time': its own push at p_remind_at, out of the summary;
-- 'off': no reminders for this habit.
create or replace function private.set_habit_reminder_impl(p_user uuid, p_habit_id uuid, p_mode text, p_remind_at time)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_mode is null or p_mode not in ('summary', 'time', 'off') or (p_mode = 'time' and p_remind_at is null) then
    raise exception 'keepup:invalid_choice' using errcode = 'P0001';
  end if;
  if p_mode = 'time' and not private.is_quarter_hour(p_remind_at) then
    raise exception 'keepup:invalid_time' using errcode = 'P0001';
  end if;
  perform private.habit_for_settings(p_user, p_habit_id);
  insert into public.habit_user_settings (user_id, habit_id, reminders, remind_at)
  values (p_user, p_habit_id, p_mode <> 'off', case when p_mode = 'time' then p_remind_at end)
  on conflict (user_id, habit_id) do update set reminders = excluded.reminders, remind_at = excluded.remind_at;
end;
$$;

-- 3. private.notify, returning how many rows it actually wrote (a deduplicated row isn't one). The
-- insert is moved here unchanged from 20260930100300_feed_nudges_cheers.sql; notify keeps its
-- signature and behaviour for every existing caller.
create function private.notify_count(
  p_recipients uuid[], p_kind text, p_dedupe text, p_group_id uuid, p_habit_id uuid, p_check_in_id uuid,
  p_actor_id uuid, p_subject_id uuid, p_payload jsonb)
returns int
language sql
set search_path = ''
as $$
  with ins as (
    insert into public.notifications (user_id, kind, group_id, habit_id, check_in_id, actor_id, subject_id, payload, dedupe_key)
    select r, p_kind, p_group_id, p_habit_id, p_check_in_id, p_actor_id, p_subject_id, coalesce(p_payload, '{}'::jsonb),
           p_dedupe || ':' || r
      from unnest(p_recipients) r
     where r is not null
    on conflict (dedupe_key) do nothing
    returning 1)
  select count(*)::int from ins;
$$;

create or replace function private.notify(
  p_recipients uuid[], p_kind text, p_dedupe text, p_group_id uuid, p_habit_id uuid, p_check_in_id uuid,
  p_actor_id uuid, p_subject_id uuid, p_payload jsonb)
returns void
language sql
set search_path = ''
as $$
  select private.notify_count(p_recipients, p_kind, p_dedupe, p_group_id, p_habit_id, p_check_in_id,
                              p_actor_id, p_subject_id, p_payload);
$$;

-- 4. The instant a local wall-clock time happens on a local date. A time the clocks skip (spring
-- forward) lands an hour later; one they repeat (fall back) is its second occurrence, after the
-- clocks go back (Postgres reads an ambiguous local time in the offset after the transition).
create function private.local_instant(p_date date, p_time time, p_tz text)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (p_date + p_time) at time zone p_tz;
$$;

-- 5. The person's habits still open for them today, each in its own calendar. at_risk: a weekly or
-- monthly habit whose days left (today included) equal the check-ins still needed.
create function private.reminder_items(p_user uuid, p_now timestamptz)
returns table (habit_id uuid, title text, period public.habit_period, done int, target int, days_left int,
               remind_at time, at_risk boolean, created_at timestamptz)
language sql
stable
set search_path = ''
as $$
  select h.id, h.title, h.period, n.cnt, h.target_count::int, d.days_left, s.remind_at,
         h.period <> 'day' and d.days_left = h.target_count - n.cnt, h.created_at
    from public.habits h
    left join public.habit_user_settings s on s.user_id = p_user and s.habit_id = h.id
   cross join lateral (select private.habit_today(h, p_now) as today) t
   cross join lateral (select private.habit_period_start(h, t.today) as start) ps
   cross join lateral (select (private.period_end(h.period, ps.start) - t.today)::int as days_left) d
   cross join lateral (
     select count(*)::int as cnt, count(*) filter (where c.local_date = t.today)::int as today_cnt
       from public.check_ins c
      where c.habit_id = h.id and c.user_id = p_user and c.period_start = ps.start
        and c.status in ('approved', 'pending')) n
   where h.archived_at is null
     and (h.owner_id = p_user
          or h.group_id in (select m.group_id from public.group_members m where m.user_id = p_user and m.left_at is null))
     and private.takes_part(h, p_user)
     and t.today >= h.starts_on
     and (h.ends_on is null or t.today <= h.ends_on)
     and not private.is_frozen(h.id, t.today, t.today + 1)
     and not private.is_member_frozen(h.id, p_user, t.today, t.today + 1)
     and not coalesce(s.muted, false)
     and coalesce(s.reminders, true)
     and n.cnt < h.target_count
     and (h.period = 'day' or n.today_cnt = 0);
$$;

-- 6. Every 15 minutes (job keepup-reminders). Adults with at least one device (decision in the M4
-- plan: reminders are opt-in through "Turn on reminders"). Each reminder is written once, in the
-- hour after its time. Returns the rows written.
-- Locks: the summaries come first and reference only the person's adult profile (only children's
-- profiles are ever locked FOR UPDATE, by children.sql and the kid check-in trigger). Then every
-- habit reminder, across people, in habit id order, each habit locked (FOR KEY SHARE) before its
-- row: habit → profile, the same order a check-in takes.
create function private.enqueue_reminders(p_now timestamptz)
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
               'todo', coalesce(jsonb_agg(jsonb_build_object('title', i.title, 'done', i.done, 'target', i.target)
                                          order by i.title, i.created_at) filter (where i.period = 'day'), '[]'::jsonb),
               'at_risk', coalesce(jsonb_agg(jsonb_build_object('title', i.title, 'done', i.done, 'target', i.target,
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

  -- remind_at is a wall-clock time in the person's own time zone. The habit's own day (the group's,
  -- for a group habit, as reminder_items judges it) keys the row, so one habit day gets one reminder.
  for r in
    select x.user_id, x.habit_id, x.habit_day
      from (select p.id as user_id, i.habit_id, private.habit_today(h, p_now) as habit_day,
                   private.local_instant(private.local_date(p_now, p.timezone), i.remind_at, p.timezone) as at
              from public.profiles p
             cross join lateral private.reminder_items(p.id, p_now) i
              join public.habits h on h.id = i.habit_id
             where p.kind = 'adult' and exists (select 1 from public.push_subscriptions ps where ps.user_id = p.id)
               and i.remind_at is not null) x
     where p_now >= x.at and p_now < x.at + interval '1 hour'
     order by x.habit_id, x.user_id
  loop
    perform 1 from public.habits h where h.id = r.habit_id for key share;
    if not found then
      continue;
    end if;
    v_n := v_n + private.notify_count(array[r.user_id], 'habit_reminder',
      'habit_reminder:' || r.habit_id || ':' || r.habit_day, null, r.habit_id, null, null, null, '{}'::jsonb);
  end loop;
  return v_n;
end;
$$;

-- 7. #3 (job keepup-expiring-approvals): pending check-ins whose review window closes within 2 hours,
-- to the other current adults. Returns the rows written.
-- Locks: as finalize_periods, habits in id order, each locked FOR UPDATE before its check-in is read
-- again, so a review or expiry that got there first (it holds the habit too) is seen and nothing is
-- written for it. Then the check-in and group are shared by the feed insert: habit → check-in → group.
create function private.enqueue_expiring_approvals(p_now timestamptz)
returns int
language plpgsql
set search_path = ''
as $$
declare
  r record;
  v_n int := 0;
begin
  for r in
    select c.id, c.user_id, c.habit_id, h.group_id
      from public.check_ins c
      join public.habits h on h.id = c.habit_id
     where c.status = 'pending' and h.group_id is not null and h.archived_at is null
       and p_now >= private.review_deadline(h, c.period_start) - interval '2 hours'
       and p_now < private.review_deadline(h, c.period_start)
     order by h.id, c.id
  loop
    perform 1 from public.habits h where h.id = r.habit_id and h.archived_at is null for update;
    if not found then
      continue;
    end if;
    if not exists (select 1 from public.check_ins c where c.id = r.id and c.status = 'pending') then
      continue;
    end if;
    v_n := v_n + private.notify_count(private.group_adults(r.group_id, array[r.user_id]), 'approval_expiring',
      'expiring:' || r.id, r.group_id, r.habit_id, r.id, r.user_id, null, '{}'::jsonb);
  end loop;
  return v_n;
end;
$$;

-- 8. Two jobs, each its own transaction: an error in one doesn't roll back the other.
select cron.schedule('keepup-reminders', '*/15 * * * *', $$select private.enqueue_reminders(now())$$);
select cron.schedule('keepup-expiring-approvals', '*/15 * * * *', $$select private.enqueue_expiring_approvals(now())$$);
