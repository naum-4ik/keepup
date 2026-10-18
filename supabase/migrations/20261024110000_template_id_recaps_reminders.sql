-- Template ids in recaps and the daily summary (task 8.5, fix round 1). Copied from their latest
-- definitions; only 'template' is added next to each habit 'title':
--   private.recap_impl          20261015100000_m5_final_review.sql (live: public.recaps reads it; also
--                               the stored weekly/monthly recap push payloads from now on)
--   private.enqueue_reminders   20261008100000_m4_followups.sql (daily_summary todo/at_risk items)
-- Payloads stored before this keep only their titles.

comment on function private.habit_templates_en() is
  'Backfill-only: a frozen copy of the en.json habit templates as of 2026-10-18 (scripts/gen-habit-templates-sql.mjs). Kept so pgTAP can re-run the backfill; not the live catalog.';
comment on function private.backfill_habit_template_ids() is
  'Backfill-only (20261024100000_habit_template_id.sql): sets template_id from the frozen English titles. Kept for pgTAP.';

create or replace function private.recap_impl(p_user uuid, p_kind text, p_start date, p_now timestamptz)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_end date;
  v_tz text;
  v_at timestamptz;
  v_result jsonb;
begin
  if p_kind is null or p_kind not in ('week', 'month') then
    raise exception 'keepup:invalid_choice' using errcode = 'P0001';
  end if;
  v_end := case p_kind when 'week' then p_start + 7 else (p_start + interval '1 month')::date end;
  select p.timezone into v_tz from public.profiles p where p.id = p_user;
  -- The streaks as they stood at the last instant of the range: at its end's midnight the next
  -- period would already be the current one, and a check-in in it would lengthen the streak.
  v_at := least(private.local_midnight(v_end, v_tz) - interval '1 microsecond', p_now);

  with hs as (
    select h as habit, h.id, h.title, h.template_id, h.emoji, h.period, h.target_count, h.group_id, h.ends_on, h.archived_at,
           private.first_period_start(h) as first_ps
      from public.habits h
     where (h.owner_id = p_user or h.id in (select private.person_group_habits(p_user)))
       and h.starts_on < v_end
       and (p_kind = 'month' or h.period <> 'month')
  ), periods as (
    select hs.id, hs.period, hs.target_count, d::date as ps,
           case when hs.group_id is null
                then coalesce((select x.outcome from public.period_results x where x.habit_id = hs.id and x.period_start = d::date),
                              private.period_outcome(hs.habit, d::date))
                else (select o.outcome from private.person_period_outcome(hs.habit, p_user, d::date, p_now) o)
           end as outcome
      from hs cross join generate_series(p_start::timestamp, (v_end - 1)::timestamp, interval '1 day') d
     where private.habit_period_start(hs.habit, d::date) = d::date
       and d::date >= hs.first_ps
       and (hs.ends_on is null or d::date <= hs.ends_on)
       and (hs.archived_at is null or hs.archived_at > private.local_midnight(d::date, private.habit_timezone(hs.habit)))
       and d::date <= private.local_date(p_now, v_tz)
       and not private.is_frozen(hs.id, d::date, private.period_end(hs.period, d::date))
       and not private.is_member_frozen(hs.id, p_user, d::date, private.period_end(hs.period, d::date))
  ), counted as (
    select q.* from (
      select p.*, least(p.target_count, (select count(*) from public.check_ins c
                                          where c.habit_id = p.id and c.user_id = p_user and c.period_start = p.ps
                                            and c.status = 'approved'))::int as n
        from periods p
       -- null: a group period p_user wasn't required in.
       where p.outcome is not null and p.outcome <> 'rested') q
     where q.outcome <> 'skipped' or q.n >= q.target_count
  ), streaks as (
    select hs.title, hs.template_id, hs.emoji, hs.period, st.length
      from hs cross join lateral (
             select case when hs.group_id is null then (select s.current_streak from private.habit_streaks(hs.id, v_at) s)
                         else private.own_streak(hs.habit, p_user, v_at) end as length) st
     where st.length > 0
       and (hs.archived_at is null or hs.archived_at > v_at)
       and (hs.ends_on is null or hs.ends_on >= p_start)
  ), top3 as (
    select s.* from streaks s order by s.length desc, s.title limit 3
  )
  select jsonb_build_object(
    'kind', p_kind, 'start', p_start, 'end', v_end,
    'done', coalesce((select sum(c.n) from counted c), 0),
    'possible', coalesce((select sum(c.target_count) from counted c), 0),
    'rested', (select count(*)::int from periods p where p.outcome = 'rested'),
    'longest', (select jsonb_build_object('title', s.title, 'template', s.template_id, 'emoji', s.emoji, 'length', s.length, 'period', s.period)
                  from top3 s order by s.length desc, s.title limit 1),
    'top', coalesce((select jsonb_agg(jsonb_build_object('title', s.title, 'template', s.template_id, 'emoji', s.emoji, 'length', s.length, 'period', s.period)
                                      order by s.length desc, s.title) from top3 s), '[]'::jsonb),
    'badges', coalesce((select jsonb_agg(jsonb_build_object('code', a.code, 'name', a.name) order by ua.unlocked_at, a.sort_order)
                          from public.user_achievements ua join public.achievements a on a.code = ua.achievement_code
                         where ua.user_id = p_user
                           and ua.unlocked_at >= private.local_midnight(p_start, v_tz)
                           and ua.unlocked_at < private.local_midnight(v_end, v_tz)), '[]'::jsonb),
    -- A day per daily-habit day that counted, for the heatmap; a day with only rested habits reads
    -- 0 of 0, rested.
    'days', coalesce((select jsonb_agg(jsonb_build_object('date', x.ps, 'done', x.done, 'possible', x.possible, 'rested', x.rested)
                                       order by x.ps)
                        from (select y.ps, sum(y.n)::int as done, sum(y.target_count)::int as possible, sum(y.rested)::int as rested
                                from (select c.ps, c.n, c.target_count, 0 as rested from counted c where c.period = 'day'
                                      union all
                                      select p.ps, 0, 0, 1 from periods p where p.period = 'day' and p.outcome = 'rested') y
                               group by y.ps) x), '[]'::jsonb))
    into v_result;
  return v_result;
end;
$$;

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
  return v_n;
end;
$$;
