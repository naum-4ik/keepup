-- Weekly overview for Today and Progress: how the owner's week is going across all active habits.
--
-- The week is the owner's calendar week (profile week start and time zone). Every habit period is
-- judged by the existing rules (finalized period_results first, then private.period_outcome), so
-- pauses, the partial first period and days before starts_on are handled exactly as streaks are:
--  * done    -> counts in done and possible
--  * missed  -> counts in possible only
--  * skipped (paused, or the partial first period) -> not counted
--  * the open current period -> counts only once it's done, so `possible` never drops mid-day.
-- A period belongs to the week it finished in: a done period to the week of the local date of its
-- target-reaching check-in, a missed period to the week of its last day. A daily habit counts each
-- day; a weekly habit once, when done; a monthly habit in the week its month finished.
create function private.week_overview_impl(p_user uuid, p_now timestamptz)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with wk as (
    select t.today, t.week_start, private.period_start('week', t.today, t.week_start) as ws
      from (select private.local_date(p_now, p.timezone) as today, p.week_start
              from public.profiles p where p.id = p_user) t
  ),
  hs as (
    select h as habit, h.id, h.title, h.period, h.target_count, h.created_at,
           private.first_period_start(h) as first_ps,
           private.habit_period_start(h, wk.today) as cur_ps,
           private.habit_period_start(h, wk.ws - 7) as from_ps
      from public.habits h cross join wk
     where h.owner_id = p_user and h.archived_at is null
  ),
  -- Every period of every habit that can touch last week or this week, with its outcome.
  periods as (
    select hs.id, hs.period, s.d::date as ps, private.period_end(hs.period, s.d::date) as pe, hs.target_count,
           case
             when s.d::date = hs.cur_ps then
               case when private.period_outcome(hs.habit, hs.cur_ps) = 'done' then 'done' else 'open' end
             else coalesce(
               (select x.outcome from public.period_results x where x.habit_id = hs.id and x.period_start = s.d::date),
               private.period_outcome(hs.habit, s.d::date))
           end as outcome
      from hs
      cross join lateral generate_series(greatest(hs.first_ps, hs.from_ps)::timestamp, hs.cur_ps::timestamp,
                                         private.period_step(hs.period)) as s(d)
  ),
  anchored as (
    select p.*,
           case p.outcome
             when 'done' then coalesce(
               (select c.local_date from public.check_ins c
                 where c.habit_id = p.id and c.period_start = p.ps and c.status = 'approved'
                 order by c.created_at, c.local_date
                offset p.target_count - 1 limit 1),
               p.pe - 1)
             when 'missed' then p.pe - 1
           end as anchor
      from periods p
  ),
  totals as (
    select count(*) filter (where a.outcome = 'done' and a.anchor >= wk.ws and a.anchor < wk.ws + 7)::int as done,
           count(*) filter (where a.outcome in ('done', 'missed') and a.anchor >= wk.ws and a.anchor < wk.ws + 7)::int as possible,
           count(*) filter (where a.outcome = 'done' and a.anchor >= wk.ws - 7 and a.anchor < wk.ws)::int as prev_done,
           count(*) filter (where a.outcome in ('done', 'missed') and a.anchor >= wk.ws - 7 and a.anchor < wk.ws)::int as prev_possible
      from wk left join anchored a on true
     group by wk.ws
  ),
  -- Today's circle fills against every daily habit that is on today (started, not paused).
  days as (
    select g.d::date as local_date,
           count(p.id) filter (where g.d::date <= wk.today and p.outcome = 'done')::int as daily_done,
           count(p.id) filter (where
             (g.d::date < wk.today and p.outcome in ('done', 'missed'))
             or (g.d::date = wk.today and (p.outcome = 'done' or not private.is_frozen(p.id, wk.today, wk.today + 1)))
           )::int as daily_possible
      from wk
      cross join lateral generate_series(wk.ws::timestamp, (wk.ws + 6)::timestamp, interval '1 day') as g(d)
      left join periods p on p.period = 'day' and p.ps = g.d::date
     group by g.d
  ),
  best as (
    select hs.title, hs.period, st.current_streak
      from hs cross join lateral private.habit_streaks(hs.id, p_now) st
     where st.current_streak > 0
     order by st.current_streak desc, hs.created_at
     limit 1
  ),
  -- The last 7 local days (daily habits) or up to 7 periods (weekly, monthly), per habit.
  per_habit as (
    select hs.id, hs.created_at,
           (select jsonb_agg(jsonb_build_object('period_start', c.ps, 'status', c.status) order by c.ps)
              from (
                select coalesce(hh.period_start, g.d::date) as ps,
                       case
                         when hh.outcome is null then 'not_started'
                         when hh.outcome = 'skipped' then
                           case when private.is_frozen(hs.id, hh.period_start, private.period_end(hs.period, hh.period_start))
                                then 'paused' else 'not_started' end
                         else hh.outcome
                       end as status
                  from (select * from private.habit_history(hs.id, p_user, p_now, 7)) hh
                  full join (select d from wk cross join lateral generate_series((wk.today - 6)::timestamp, wk.today::timestamp, interval '1 day') as d
                              where hs.period = 'day') g
                    on hh.period_start = g.d::date
              ) c) as cells
      from hs
  )
  select jsonb_build_object(
    'today', wk.today,
    'week_start', wk.ws,
    'done', t.done,
    'possible', t.possible,
    'prev_done', t.prev_done,
    'prev_possible', t.prev_possible,
    'days', (select jsonb_agg(jsonb_build_object('local_date', d.local_date, 'daily_done', d.daily_done,
                                                 'daily_possible', d.daily_possible) order by d.local_date) from days d),
    'best_current_streak', coalesce((select b.current_streak from best b), 0),
    'best_current_streak_title', (select b.title from best b),
    'best_current_streak_period', (select b.period from best b),
    'check_ins', (select count(*)::int from public.check_ins c join hs on hs.id = c.habit_id
                   where c.user_id = p_user and c.status = 'approved' and c.local_date >= wk.ws and c.local_date < wk.ws + 7),
    'active_habits', (select count(*)::int from hs),
    'per_habit', coalesce((select jsonb_agg(jsonb_build_object('habit_id', ph.id, 'cells', coalesce(ph.cells, '[]'::jsonb))
                                            order by ph.created_at) from per_habit ph), '[]'::jsonb))
    from wk cross join totals t;
$$;

create function public.week_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'keepup:not_authenticated' using errcode = '42501';
  end if;
  return private.week_overview_impl(auth.uid(), now());
end;
$$;

revoke execute on function public.week_overview() from public, anon;
grant execute on function public.week_overview() to authenticated;
