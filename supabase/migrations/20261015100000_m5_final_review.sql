-- M5 final review fixes. Replaced functions are copied from their latest definitions; only the parts
-- named here change:
--   private.rewards_on_period_result   20261012100000_rest_days.sql
--     I1: a period that settles or is upgraded done also judges the badges at the last done period of
--     the walk forward (up to the next missed one), like period_milestones. A late tap that joins two
--     runs (12–16 and 18–19, the 17th upgraded) earns First week (and every other badge that reads
--     the run: Two weeks strong … Year-round, Free, Hydrated, Back on track, Steady month's monthly
--     rule) at once, not only at the next settle. Same moment (v_at), same late flag, queued
--     (p_sync = false) and written by the one sync. Every other rule in badges_on_period is
--     idempotent (the badge PK, the queue, the per-person-and-week Perfect week dedupe).
--   private.recap_impl                 20261013100000_recaps.sql
--     M5: the longest streak of a group habit is the person's own part (private.own_streak, the
--     check_in_streak rule), as every other M5 rule judges a group habit; private habits keep
--     habit_streaks.
--   public.check_in_with               20261009100000_xp_ledger.sql
--     M7: the children are checked in in id order, whatever order the app sends, so two parents
--     checking in the same children (each child's profile is locked by kid_rewards_on_check_in) take
--     those locks in one order.
--   private.habit_streaks              20260930100100_group_habits.sql
--     M4: a period not settled yet is read with settled_outcome (what finalize will write), so a day a
--     saved rest day will cover keeps the streak during the minutes before finalize runs, as
--     check_in_streak already does. Group and monthly habits have no rest days (unchanged).
--
-- Locks: unchanged (habit → check-in → period_results → per-habit rows → per-person rows, in user id
-- order). The new reads (the walk's last done period, own_streak) take no locks; the second
-- badges_on_period call queues its awards for sync_deferred_levels like the first.

-- Copied from 20261012100000_rest_days.sql (its latest definition). New: I1 (header).
create or replace function private.rewards_on_period_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_habit public.habits;
  v_at timestamptz := new.finalized_at;
  v_late boolean := false;
  v_check_in public.check_ins;
  v_last date;
begin
  if tg_op = 'UPDATE' and new.outcome is not distinct from old.outcome then
    return new;
  end if;
  select h.* into v_habit from public.habits h where h.id = new.habit_id;
  if not found then
    return new;
  end if;
  if new.outcome = 'done' then
    if tg_op = 'UPDATE' then
      -- The tap or approval that made it done: the latest approved check-in in the period.
      select c.* into v_check_in from public.check_ins c
       where c.habit_id = new.habit_id and c.period_start = new.period_start and c.status = 'approved'
       order by coalesce(c.reviewed_at, c.created_at) desc, c.id desc limit 1;
      v_late := found and private.is_late_check_in(v_habit, v_check_in);
      v_at := coalesce(v_check_in.reviewed_at, v_check_in.created_at, now());
    end if;
    perform private.grant_period_xp(v_habit, new.period_start, v_at, false, false);
    perform private.period_milestones(v_habit, new.period_start, v_at, false, false, v_late);
    perform private.badges_on_period(v_habit, new.period_start, 'done', v_at, false, false, v_late);
    -- The streak badges read the run, which a late upgrade can extend past this period: judge them
    -- again at the last done period of the walk forward (up to the next missed one), as
    -- period_milestones does, at the same moment and late flag, queued like every other award.
    select max(x.period_start) into v_last from public.period_results x
     where x.habit_id = new.habit_id and x.period_start > new.period_start and x.outcome = 'done'
       and x.period_start < coalesce((select min(m.period_start) from public.period_results m
                                       where m.habit_id = new.habit_id and m.period_start > new.period_start and m.outcome = 'missed'),
                                     'infinity'::date);
    if v_last is not null then
      perform private.badges_on_period(v_habit, v_last, 'done', v_at, false, false, v_late);
    end if;
  else
    -- A rest day used: "Rest day used. Your 7-day streak is safe" to an adult owner (a per-habit
    -- row, Achievements: Inbox only by default). Kids get none (no Inbox).
    if new.outcome = 'rested' and (select p.kind from public.profiles p where p.id = v_habit.owner_id) = 'adult' then
      perform private.notify(array[v_habit.owner_id], 'rest_day_used', 'rest_day_used:' || v_habit.id || ':' || new.period_start,
        null, v_habit.id, null, null, null,
        jsonb_build_object('streak', private.run_before(v_habit, new.period_start), 'period', v_habit.period));
    end if;
    -- Any other settle still judges Perfect week (a member's own part can be done); rested also
    -- queues Rest well (badges_on_period).
    perform private.badges_on_period(v_habit, new.period_start, new.outcome, v_at, false, false, false);
  end if;
  -- Levels (and badges) are synced once for everyone, in user id order: inside finalize's habit loop,
  -- after the loop (finalize does it); otherwise now, together with an upgrading check-in's author and
  -- reviewer, deferred by rewards_on_check_in (Locks, at the top).
  if current_setting('keepup.defer_levels', true) is distinct from 'on' then
    perform private.sync_deferred_levels();
  end if;
  return new;
end;
$$;


-- A person's current streak on a group habit, their own part, at p_at: the run going into the current
-- period (private.check_in_streak, uncapped) plus the current period when their own part of it is done
-- and they take part in it (as habit_streaks counts a done current period).
create function private.own_streak(p_habit public.habits, p_user uuid, p_at timestamptz)
returns int
language sql
stable
set search_path = ''
as $$
  select private.check_in_streak(p_habit, p_user, c.ps, p_at, 2147483647)
       + case when c.ps >= private.first_period_start(p_habit)
               and p_user in (select m from private.required_members(p_habit, c.ps) m)
               and (select count(*) from public.check_ins ci
                     where ci.habit_id = p_habit.id and ci.user_id = p_user and ci.period_start = c.ps
                       and ci.status = 'approved') >= p_habit.target_count
              then 1 else 0 end
    from (select private.habit_period_start(p_habit, private.habit_last_date(p_habit, p_at)) as ps) c;
$$;

-- Copied from 20261013100000_recaps.sql (its only definition). New: M5 (header).
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
    select h as habit, h.id, h.title, h.emoji, h.period, h.target_count, h.group_id, h.ends_on, h.archived_at,
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
    select hs.title, hs.emoji, hs.period, st.length
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
    'longest', (select jsonb_build_object('title', s.title, 'emoji', s.emoji, 'length', s.length, 'period', s.period)
                  from top3 s order by s.length desc, s.title limit 1),
    'top', coalesce((select jsonb_agg(jsonb_build_object('title', s.title, 'emoji', s.emoji, 'length', s.length, 'period', s.period)
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


-- Copied from 20261009100000_xp_ledger.sql (its latest definition). New: M7 (header).
create or replace function public.check_in_with(p_habit_id uuid, p_children uuid[])
returns setof public.check_ins language plpgsql security definer set search_path = '' as $$
declare
  v_row public.check_ins;
  v_child uuid;
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  perform set_config('keepup.defer_levels', 'on', true);
  v_row := private.check_in_impl(p_habit_id, auth.uid(), now());
  return next v_row;
  for v_child in select c from unnest(coalesce(p_children, '{}')) c order by c loop
    v_row := private.check_in_impl(p_habit_id, auth.uid(), now(), v_child);
    return next v_row;
  end loop;
  perform set_config('keepup.defer_levels', '', true);
  perform private.sync_deferred_levels();
end;
$$;


-- Copied from 20260930100100_group_habits.sql (its latest definition). New: M4 (header).
create or replace function private.habit_streaks(p_habit_id uuid, p_now timestamptz)
returns table (current_streak int, best_streak int)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_habit public.habits;
  v_step interval;
  v_current date;
  v_run int := 0;
  v_best int := 0;
  v_outcome text;
  r record;
begin
  select h.* into v_habit from public.habits h where h.id = p_habit_id;
  if not found then
    current_streak := 0;
    best_streak := 0;
    return next;
    return;
  end if;
  v_step := private.period_step(v_habit.period);
  v_current := private.habit_period_start(v_habit, private.habit_last_date(v_habit, p_now));

  for r in
    select s.d::date as ps
      from generate_series(private.first_period_start(v_habit)::timestamp, v_current::timestamp - v_step, v_step) as s(d)
     order by 1
  loop
    v_outcome := null;
    select x.outcome into v_outcome from public.period_results x
     where x.habit_id = p_habit_id and x.period_start = r.ps;
    if v_outcome is null then
      v_outcome := private.settled_outcome(v_habit, r.ps);
      if v_outcome <> 'done' and private.in_grace(v_habit, r.ps, p_now) then
        v_outcome := 'open';
      end if;
    end if;
    if v_outcome = 'done' then
      v_run := v_run + 1;
      v_best := greatest(v_best, v_run);
    elsif v_outcome = 'missed' then
      v_run := 0;
    end if;
  end loop;

  if v_current >= private.first_period_start(v_habit)
     and private.period_outcome(v_habit, v_current) = 'done' then
    v_run := v_run + 1;
    v_best := greatest(v_best, v_run);
  end if;

  current_streak := v_run;
  best_streak := v_best;
  return next;
end;
$$;

