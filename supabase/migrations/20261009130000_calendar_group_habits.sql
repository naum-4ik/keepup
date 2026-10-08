-- Progress → Calendar counts the group habits you take part in (owner, 2026-10-05), the same way
-- Today's "This week" does since 20261009120000. Before, calendar_cells and the calendar's first
-- month read only habits you own (owner_id = p_user), so the month and the week circles disagreed on
-- a day with a group habit.
--
-- One rule for both, so they can't drift:
--   private.person_group_habits(p_user): the group habits p_user takes part in (current members of
--     the group, and children included in the habit who are still in its group; same people as
--     takes_part and subject_summaries).
--   private.person_period_outcome(habit, p_user, period_start, p_now): one group period judged for
--     p_user, moved here unchanged from week_overview_impl. due: started and not after the end.
--     required: p_user is one of private.required_members (joined before it began, not paused in
--     it). outcome: null unless due and required; 'done' when p_user's own approved check-ins reach
--     the target (the Today ring's rule); 'open' for the current period (the group's calendar);
--     'skipped' when the group skips it; else 'missed'.
-- week_overview_impl now calls both (copied from 20261009120000, its latest; nothing else changes).

create function private.person_group_habits(p_user uuid)
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select gh.id from public.group_members m
    join public.habits gh on gh.group_id = m.group_id
   where m.user_id = p_user and m.left_at is null
  union all
  select gp.habit_id from public.group_habit_participants gp
    join public.profiles c on c.id = gp.profile_id
    join public.habits ph on ph.id = gp.habit_id and ph.group_id = c.group_id
   where gp.profile_id = p_user;
$$;

create function private.person_period_outcome(p_habit public.habits, p_user uuid, p_period_start date, p_now timestamptz)
returns table (due boolean, required boolean, outcome text)
language sql
stable
set search_path = ''
as $$
  with f as (
    select p_period_start >= private.first_period_start(p_habit)
             and (p_habit.ends_on is null or p_period_start <= private.habit_period_start(p_habit, p_habit.ends_on)) as due,
           p_user in (select r from private.required_members(p_habit, p_period_start) r) as required,
           (select count(*) from public.check_ins c
             where c.habit_id = p_habit.id and c.user_id = p_user and c.period_start = p_period_start
               and c.status = 'approved') >= p_habit.target_count as mine_done,
           p_period_start = private.habit_period_start(p_habit, private.habit_today(p_habit, p_now)) as is_current
  )
  select f.due, f.required,
         case
           when not (f.due and f.required) then null
           when f.mine_done then 'done'
           when f.is_current then 'open'
           when coalesce(
             (select x.outcome from public.period_results x where x.habit_id = p_habit.id and x.period_start = p_period_start),
             private.period_outcome(p_habit, p_period_start)) = 'skipped' then 'skipped'
           else 'missed'
         end
    from f;
$$;

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
    select h as habit, h.id, h.title, h.period, h.target_count, h.created_at, h.ends_on,
           h.ends_on is not null and h.ends_on < private.habit_today(h, p_now) as ended,
           private.first_period_start(h) as first_ps,
           private.habit_period_start(h, wk.today) as cur_ps,
           private.habit_period_start(h, wk.ws - 7) as from_ps
      from public.habits h cross join wk
     where h.owner_id = p_user and h.archived_at is null
  ),
  -- The group habits p_user takes part in (same people as takes_part and subject_summaries).
  gs as (
    select h as habit, h.id, h.title, h.period, h.target_count, h.created_at, h.ends_on,
           h.ends_on is not null and h.ends_on < private.habit_today(h, p_now) as ended,
           private.first_period_start(h) as first_ps,
           private.habit_period_start(h, private.habit_today(h, p_now)) as cur_ps,
           private.habit_period_start(h, wk.ws - 7) as from_ps
      from public.habits h cross join wk
     where h.group_id is not null and h.archived_at is null
       and h.id in (select private.person_group_habits(p_user))
  ),
  -- Every period of every group habit that can touch last week or this week, or is one of its last
  -- 7 (the Progress dots), judged for p_user.
  gperiods as (
    select gs.habit, gs.id, gs.period, gs.target_count, gs.first_ps, gs.cur_ps, gs.from_ps,
           s.d::date as ps, private.period_end(gs.period, s.d::date) as pe, o.due, o.required, o.outcome
      from gs
      cross join lateral generate_series(
        least(gs.from_ps::timestamp, gs.cur_ps::timestamp - private.period_step(gs.period) * 6),
        gs.cur_ps::timestamp, private.period_step(gs.period)) as s(d)
      cross join lateral private.person_period_outcome(gs.habit, p_user, s.d::date, p_now) o
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
     -- Nothing is due after the end (as for group habits): an ended habit's today isn't "to do".
     where hs.ends_on is null or s.d::date <= private.habit_period_start(hs.habit, hs.ends_on)
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
    select b.title, b.period, st.current_streak
      from (select hs.id, hs.title, hs.period, hs.created_at from hs where not hs.ended
            union all
            select gs.id, gs.title, gs.period, gs.created_at from gs where not gs.ended) b
     cross join lateral private.habit_streaks(b.id, p_now) st
     where st.current_streak > 0
     order by st.current_streak desc, b.created_at
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
    -- On a group habit, only check-ins in periods that count for you (required and due).
    'check_ins', (select count(*)::int from public.check_ins c
                   where c.user_id = p_user and c.status = 'approved' and c.local_date >= wk.ws and c.local_date < wk.ws + 7
                     and (c.habit_id in (select hs.id from hs)
                          or exists (select 1 from gperiods g
                                      where g.id = c.habit_id and g.ps = c.period_start and g.due and g.required))),
    -- A habit whose end has passed isn't active (its earlier periods still count above).
    'active_habits', (select count(*)::int from hs where not hs.ended) + (select count(*)::int from gs where not gs.ended),
    'per_habit', coalesce((select jsonb_agg(jsonb_build_object('habit_id', ph.id, 'cells', coalesce(ph.cells, '[]'::jsonb))
                                            order by ph.created_at) from per_habit ph), '[]'::jsonb))
    from wk cross join totals t;
$$;

-- calendar_cells_impl: copied from 20260930160000_calendar_cells.sql (its latest and only
-- definition). Your own habits are unchanged. Group habits you take part in now add:
--   * a daily one's outcome on each day it counts for you (private.person_period_outcome): done,
--     missed, today open, or skipped when the group skips the day. Days you weren't required on
--     (before you joined, paused) and days after its end aren't there. Today follows the group's
--     calendar (private.habit_today), as Today does; a whole-habit pause today reads skipped, like an
--     own habit's.
--   * your own check-ins, only in periods that count for you (as week_overview's check_ins).
-- An archived group habit counts up to the day it was archived, as your own do.
create or replace function private.calendar_cells_impl(p_user uuid, p_from date, p_to date, p_now timestamptz)
returns table (local_date date, habit_id uuid, outcome text, check_ins int)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_today date;
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 61 then
    raise exception 'keepup:bad_range' using errcode = 'P0001';
  end if;
  select private.local_date(p_now, p.timezone) into v_today from public.profiles p where p.id = p_user;
  return query
    with hs as (
      select h as habit, h.id, h.period,
             private.first_period_start(h) as first_ps,
             coalesce(private.local_date(h.archived_at, private.habit_timezone(h)), v_today) as last_day
        from public.habits h
       where h.owner_id = p_user
    ),
    gs as (
      select h as habit, h.id, h.period,
             private.first_period_start(h) as first_ps,
             -- least() skips a null: not archived → the group's today.
             least(private.local_date(h.archived_at, private.habit_timezone(h)), private.habit_today(h, p_now)) as last_day
        from public.habits h
       where h.group_id is not null and h.id in (select private.person_group_habits(p_user))
    ),
    daily as (
      select g.d::date as day, hs.id,
             case
               when g.d::date = v_today then
                 case when private.period_outcome(hs.habit, g.d::date) = 'done' then 'done'
                      when private.is_frozen(hs.id, g.d::date, g.d::date + 1) then 'skipped' else 'open' end
               else coalesce(
                 (select x.outcome from public.period_results x where x.habit_id = hs.id and x.period_start = g.d::date),
                 private.period_outcome(hs.habit, g.d::date))
             end as outcome
        from hs
        cross join lateral generate_series(greatest(p_from, hs.first_ps)::timestamp, least(p_to, hs.last_day, v_today)::timestamp,
                                           interval '1 day') as g(d)
       where hs.period = 'day'
      union all
      select g.d::date, gs.id,
             case when o.outcome = 'open' and private.is_frozen(gs.id, g.d::date, g.d::date + 1) then 'skipped'
                  else o.outcome end
        from gs
        cross join lateral generate_series(greatest(p_from, gs.first_ps)::timestamp, least(p_to, gs.last_day)::timestamp,
                                           interval '1 day') as g(d)
        cross join lateral private.person_period_outcome(gs.habit, p_user, g.d::date, p_now) o
       where gs.period = 'day' and o.outcome is not null
    ),
    counts as (
      select c.local_date as day, c.habit_id as id, count(*)::int as n
        from public.check_ins c join hs on hs.id = c.habit_id
       where c.user_id = p_user and c.status in ('approved', 'pending') and c.local_date between p_from and p_to
       group by 1, 2
      union all
      select c.local_date, c.habit_id, count(*)::int
        from public.check_ins c join gs on gs.id = c.habit_id
        cross join lateral private.person_period_outcome(gs.habit, p_user, c.period_start, p_now) o
       where c.user_id = p_user and c.status in ('approved', 'pending') and c.local_date between p_from and p_to
         and o.outcome is not null
       group by 1, 2
    )
    select coalesce(d.day, c.day), coalesce(d.id, c.id), d.outcome, coalesce(c.n, 0)
      from daily d full join counts c on c.day = d.day and c.id = d.id
     order by 1, 2;
end;
$$;

-- The calendar's first month: the earliest start among your own habits and the group habits you take
-- part in (for a group habit, the later of its start and the day you joined, in its time zone).
-- Archived habits count, as in calendar_cells; a habit that hasn't started yet doesn't. Month-precise:
-- the app only compares months.
create function private.calendar_start_impl(p_user uuid, p_now timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select min(x.s) from (
    select h.starts_on as s from public.habits h
     where h.owner_id = p_user and h.starts_on <= private.habit_today(h, p_now)
    union all
    select greatest(h.starts_on,
                    (select private.local_date(m.joined_at, private.habit_timezone(h)) from public.group_members m
                      where m.group_id = h.group_id and m.user_id = p_user and m.left_at is null))
      from public.habits h
     where h.group_id is not null and h.id in (select private.person_group_habits(p_user))
       and h.starts_on <= private.habit_today(h, p_now)
  ) x;
$$;

create function public.calendar_start()
returns date
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return private.calendar_start_impl(auth.uid(), now());
end;
$$;

revoke execute on function public.calendar_start() from public, anon;
grant execute on function public.calendar_start() to authenticated;
