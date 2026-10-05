-- Today's "This week" line counts the group habits you take part in (owner, 2026-10-05). It
-- counted only habits you own (h.owner_id = p_user), so a group habit never moved it.
--
-- Copied from 20260929130000_week_overview.sql (its latest and only definition). Private habits are
-- judged exactly as before. Group habits are judged for you, not for the whole group, with the same
-- "done" the Today ring and the habit card use: your own approved check-ins reach the target
-- (subject_summaries' done_count). A group period counts for you only when you are one of its
-- required members (private.required_members: joined before it began, not paused in it); a period
-- the group skips (whole-habit pause, the partial first period, after the end) isn't counted. The
-- current period follows the group's calendar (private.habit_today), as Today does.
--
-- What group habits now add to: done / possible (this week and last), the day circles (so
-- lib/week-overview.ts withTodayPending also counts today's group habits still to do), check_ins
-- (your own), active_habits, and per_habit (your own dots on Progress). The best current streak
-- stays your private habits' (a group streak is everyone's, not yours).
create or replace function private.week_overview_impl(p_user uuid, p_now timestamptz)
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
  -- The group habits p_user takes part in (same people as takes_part and subject_summaries).
  gs as (
    select h as habit, h.id, h.period, h.target_count, h.created_at, h.ends_on,
           private.first_period_start(h) as first_ps,
           private.habit_period_start(h, private.habit_today(h, p_now)) as cur_ps,
           private.habit_period_start(h, wk.ws - 7) as from_ps
      from public.habits h cross join wk
     where h.group_id is not null and h.archived_at is null
       and h.id in (
             select gh.id from public.group_members m
               join public.habits gh on gh.group_id = m.group_id
              where m.user_id = p_user and m.left_at is null
             union all
             select gp.habit_id from public.group_habit_participants gp
               join public.profiles c on c.id = gp.profile_id
               join public.habits ph on ph.id = gp.habit_id and ph.group_id = c.group_id
              where gp.profile_id = p_user)
  ),
  -- Every period of every group habit that can touch last week or this week, or is one of its last
  -- 7 (the Progress dots), judged for p_user.
  gp0 as (
    select gs.habit, gs.id, gs.period, gs.target_count, gs.first_ps, gs.cur_ps, gs.from_ps,
           s.d::date as ps, private.period_end(gs.period, s.d::date) as pe,
           s.d::date >= gs.first_ps
             and (gs.ends_on is null or s.d::date <= private.habit_period_start(gs.habit, gs.ends_on)) as due,
           p_user in (select r from private.required_members(gs.habit, s.d::date) r) as required,
           (select count(*) from public.check_ins c
             where c.habit_id = gs.id and c.user_id = p_user and c.period_start = s.d::date
               and c.status = 'approved') >= gs.target_count as mine_done
      from gs
      cross join lateral generate_series(
        least(gs.from_ps::timestamp, gs.cur_ps::timestamp - private.period_step(gs.period) * 6),
        gs.cur_ps::timestamp, private.period_step(gs.period)) as s(d)
  ),
  gperiods as (
    select g.*,
           case
             when not (g.due and g.required) then null
             when g.mine_done then 'done'
             when g.ps = g.cur_ps then 'open'
             when coalesce(
               (select x.outcome from public.period_results x where x.habit_id = g.id and x.period_start = g.ps),
               private.period_outcome(g.habit, g.ps)) = 'skipped' then 'skipped'
             else 'missed'
           end as outcome
      from gp0 g
  ),
  -- Every period of every habit that can touch last week or this week, with its outcome. Group
  -- periods you aren't required in aren't here at all.
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
    union all
    select g.id, g.period, g.ps, g.pe, g.target_count, g.outcome
      from gperiods g
     where g.outcome is not null and g.ps >= g.from_ps
  ),
  anchored as (
    select p.*,
           case p.outcome
             -- user_id: on a group habit, your own target-reaching check-in (on a private habit
             -- every check-in is the owner's anyway).
             when 'done' then coalesce(
               (select c.local_date from public.check_ins c
                 where c.habit_id = p.id and c.user_id = p_user and c.period_start = p.ps and c.status = 'approved'
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
    union all
    -- A group habit's dots are yours, with the words habit_history uses: not required in it reads
    -- paused (you or the habit were paused) or not started (you joined after it began).
    select gs.id, gs.created_at,
           (select jsonb_agg(jsonb_build_object('period_start', g.ps, 'status',
                     case
                       when not g.due then 'not_started'
                       when not g.required then
                         case when private.is_member_frozen(g.id, p_user, g.ps, g.pe) or private.is_frozen(g.id, g.ps, g.pe)
                              then 'paused' else 'not_started' end
                       when g.outcome = 'done' then 'done'
                       when g.outcome = 'open' then case when private.is_frozen(g.id, g.ps, g.pe) then 'paused' else 'open' end
                       when g.outcome = 'skipped' then case when private.is_frozen(g.id, g.ps, g.pe) then 'paused' else 'not_started' end
                       -- An approval habit's closed period still waits for reviews (habit_history's grace).
                       when private.in_grace(g.habit, g.ps, p_now) then 'open'
                       else 'missed'
                     end) order by g.ps)
              from gperiods g
             where g.id = gs.id
               and g.ps >= (gs.cur_ps::timestamp - private.period_step(gs.period) * 6)::date
               and (gs.period = 'day' or g.ps >= gs.first_ps)) as cells
      from gs
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
    'check_ins', (select count(*)::int from public.check_ins c
                   where c.habit_id in (select hs.id from hs union all select gs.id from gs)
                     and c.user_id = p_user and c.status = 'approved' and c.local_date >= wk.ws and c.local_date < wk.ws + 7),
    'active_habits', (select count(*)::int from hs) + (select count(*)::int from gs),
    'per_habit', coalesce((select jsonb_agg(jsonb_build_object('habit_id', ph.id, 'cells', coalesce(ph.cells, '[]'::jsonb))
                                            order by ph.created_at) from per_habit ph), '[]'::jsonb))
    from wk cross join totals t;
$$;
