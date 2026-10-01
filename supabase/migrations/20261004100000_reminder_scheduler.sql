-- supabase/migrations/20261004100000_reminder_scheduler.sql
-- The reminder scheduler (spec: Pipeline step 4, Daily reminder content; ideas/notifications-tone.md).
--
-- Lock order (see 20261001100000_db_hardening.sql): habit rows (ascending id) → check-in rows, with
-- the group row after the habits. A feed insert takes FOR KEY SHARE on every row it references
-- (profile, group, habit, check-in) in an order this file doesn't control, so each job below locks
-- the habit itself, in habit id order, before it writes a row that references one. keepup-finalize-periods
-- runs at the same minutes and locks habits FOR UPDATE in id order, and deleting a group locks its
-- habits before the group row, so both wait for these jobs (or the other way round) instead of
-- deadlocking. The daily summary references only the person's profile, which nothing here
-- locks after a habit.

-- Copied from 20261002100000_notification_prefs_push.sql; reminders and "approval expiring" join.
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

-- The instant a local wall-clock time happens on a local date. A time the clocks skip (spring
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

-- The person's habits still open for them today, each in its own calendar. at_risk: a weekly or
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

-- Every 15 minutes. Adults with at least one device (decision in the M4 plan: reminders are opt-in
-- through "Turn on reminders"). Each reminder is written once, in the hour after its time.
-- Summaries first (profile only), then every habit reminder in habit id order (see the lock order).
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
        perform private.notify(array[v_user.id], 'daily_summary', 'daily_summary:' || v_today, null, null, null, null, null, v_items);
        v_n := v_n + 1;
      end if;
    end if;
  end loop;

  -- remind_at is in the person's own time zone.
  for r in
    select x.user_id, x.habit_id, x.local_day
      from (select p.id as user_id, i.habit_id, private.local_date(p_now, p.timezone) as local_day,
                   private.local_instant(private.local_date(p_now, p.timezone), i.remind_at, p.timezone) as at
              from public.profiles p
             cross join lateral private.reminder_items(p.id, p_now) i
             where p.kind = 'adult' and exists (select 1 from public.push_subscriptions ps where ps.user_id = p.id)
               and i.remind_at is not null) x
     where p_now >= x.at and p_now < x.at + interval '1 hour'
     order by x.habit_id, x.user_id
  loop
    perform 1 from public.habits h where h.id = r.habit_id for key share;
    if not found then
      continue;
    end if;
    perform private.notify(array[r.user_id], 'habit_reminder', 'habit_reminder:' || r.habit_id || ':' || r.local_day,
      null, r.habit_id, null, null, null, '{}'::jsonb);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- #3: pending check-ins whose review window closes within 2 hours, to the other current adults.
-- As finalize_periods: habits in id order, each locked before its check-ins are read again, so a
-- review or expiry that got there first is seen and nothing is written for it.
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
    perform private.notify(private.group_adults(r.group_id, array[r.user_id]), 'approval_expiring', 'expiring:' || r.id,
      r.group_id, r.habit_id, r.id, r.user_id, null, '{}'::jsonb);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- Both jobs run in one transaction per tick: an error in either rolls the tick back and the next
-- one (still inside every one-hour window) writes the rows again.
select cron.schedule('keepup-reminders', '*/15 * * * *',
  $$select private.enqueue_reminders(now()); select private.enqueue_expiring_approvals(now());$$);
