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
--   private.push_allowed               20261010100000_streak_milestones.sql
--     Owner 2026-10-06: late personal notes never push. streak_milestone, badge_unlocked and
--     level_up with late = true stay in the Inbox, like the late group kinds.
--   private.sync_level                 20261009100000_xp_ledger.sql
--   private.sync_deferred_levels       20261011100000_badges.sql
--     A level_up note carries late = true when the person's XP in this transaction came from a late
--     check-in: rewards_on_check_in marks the author of a late check-in, and rewards_on_period_result
--     marks everyone a late upgrade pays (the owner, or the period's required members), in the
--     transaction-local keepup.late_users. sync_level reads it; sync_deferred_levels clears it with the
--     other queues. In one "Approve all" batch, an author with a late and an on-time item gets one
--     level_up (one per sync, as before), marked late.
--   private.rewards_on_check_in        20261014100000_streak_check_in_xp.sql
--     Owner 2026-10-06: the streak bonus counts once per habit per period. The person's first counted
--     check-in of a period earns 10 + min(streak before, 20); a further one, while an earlier counted
--     one of theirs stands, earns 10 (8 a day on a 20-day streak: 30 + 7 × 10 = 100). An undo still
--     reverses exactly what was granted (the ledger amount); undoing the first doesn't re-grant the
--     others. The author of a late check-in is marked for a late level_up (above).
--   private.rewards_on_period_result (above) also marks a late upgrade's payees.
--   private.badges_on_period           20261012100000_rest_days.sql
--     Controller ruling 2026-10-06 (owner: your own part): a group habit's streak badges read each
--     member's own streak at the judged period (check_in_streak; Back on track: private.own_comeback),
--     at any settle of a period whose own part they did. Milestones stay on the group run (group notes).
--
-- Locks: unchanged (habit → check-in → period_results → per-habit rows → per-person rows, in user id
-- order). The new reads (the walk's last done period, own_streak) take no locks; the second
-- badges_on_period call queues its awards for sync_deferred_levels like the first.

-- The people whose level-up in this transaction comes from a late check-in (sync_level marks the
-- note late). Transaction-local, cleared by sync_deferred_levels.
create function private.mark_late_levels(p_users uuid[])
returns void
language sql
set search_path = ''
as $$
  select set_config('keepup.late_users',
    concat_ws(',', nullif(current_setting('keepup.late_users', true), ''), nullif(array_to_string(p_users, ','), '')), true);
$$;

-- Copied from 20261012100000_rest_days.sql (its latest definition). New: I1, and a late upgrade's
-- payees are marked for a late level_up (header).
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
    if v_late then
      perform private.mark_late_levels(array(
        select p_id from (select v_habit.owner_id as p_id where v_habit.group_id is null
                          union
                          select m.profile_id from private.required_members(v_habit, new.period_start) m(profile_id)
                           where v_habit.group_id is not null) u where p_id is not null));
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

-- Copied from 20261010100000_streak_milestones.sql (its latest definition). New: late personal notes stay in the Inbox (header).
create or replace function private.push_allowed(
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
       and (c.category = 'always'
            or coalesce(np.delivery, case when c.category = 'achievements' then 'inbox' else 'silent' end) <> 'inbox')
       and (p_kind <> 'group_streak_ended'
            or (case when p_payload ->> 'streak' ~ '^\d{1,9}$' then (p_payload ->> 'streak')::int else 0 end) >= 3)
       and (p_kind <> 'member_joined' or private.is_admin(p_group_id, p_user))
       and (p_kind <> 'streak_back' or p_group_id is not null)
       and (p_kind not in ('group_check_in', 'everyone_done', 'kid_garden_full', 'group_milestone', 'kid_streak',
                           'streak_milestone', 'badge_unlocked', 'level_up')
            or p_payload ->> 'late' is distinct from 'true')
      from (select private.push_category(p_kind) as category) c
      join public.profiles p on p.id = p_user
      left join public.habit_user_settings s on s.user_id = p_user and s.habit_id = p_habit_id
      left join public.notification_prefs np on np.user_id = p_user and np.category = c.category), false);
$$;


-- Copied from 20261009100000_xp_ledger.sql (its only definition). New: a late level_up (header).
create or replace function private.sync_level(p_user uuid, p_quiet boolean)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_level int;
  v_top int;
begin
  select private.level_for(coalesce(sum(x.amount), 0)) into v_level from public.xp_events x where x.user_id = p_user;
  if v_level < 2 then
    return;
  end if;
  with ins as (
    insert into public.level_ups (user_id, level, seen_at)
    select p_user, l, case when p_quiet then now() end from generate_series(2, v_level) l
    on conflict (user_id, level) do nothing
    returning level)
  select max(level) into v_top from ins;
  if v_top is not null and not p_quiet
     and (select p.kind from public.profiles p where p.id = p_user) = 'adult' then
    perform private.notify(array[p_user], 'level_up', 'level_up:' || v_top, null, null, null, null, null,
      jsonb_build_object('level', v_top)
        || case when p_user::text = any (string_to_array(current_setting('keepup.late_users', true), ','))
                then jsonb_build_object('late', true) else '{}'::jsonb end);
  end if;
end;
$$;


-- Copied from 20261011100000_badges.sql (its latest definition). New: keepup.late_users is cleared with the other queues.
create or replace function private.sync_deferred_levels()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_list text := nullif(current_setting('keepup.unsynced', true), '');
  v_badges text := nullif(current_setting('keepup.unbadged', true), '');
  v_weeks text := nullif(current_setting('keepup.unjudged', true), '');
  r record;
begin
  perform set_config('keepup.unsynced', '', true);
  perform set_config('keepup.unbadged', '', true);
  perform set_config('keepup.unjudged', '', true);
  if v_list is null and v_badges is null and v_weeks is null then
    perform set_config('keepup.late_users', '', true);
    return;
  end if;
  for r in
    select distinct on (w.id, w.week) w.id, w.week, w.at, w.late
      from (select split_part(b, '|', 1)::uuid as id, split_part(b, '|', 2)::date as week,
                   split_part(b, '|', 3)::timestamptz as at, split_part(b, '|', 4)::boolean as late
              from unnest(string_to_array(v_weeks, ';')) b) w
     order by w.id, w.week, w.at desc
  loop
    if not exists (select 1 from public.user_achievements a where a.user_id = r.id and a.achievement_code = 'perfect_week')
       and private.perfect_week(r.id, r.week, r.at) then
      v_badges := coalesce(v_badges || ';', '') || r.id || '|perfect_week|' || r.at || '|' || r.late;
    end if;
  end loop;
  for r in
    select x.id, x.step, x.code, x.at, x.late
      from (select distinct u::uuid as id, 0 as step, null::text as code, null::timestamptz as at, false as late
              from unnest(string_to_array(v_list, ',')) u
            union all
            -- The earliest moment queued for each badge, with its late flag.
            select * from (
              select distinct on (q.id, q.code) q.id, 1, q.code, q.at, q.late
                from (select split_part(b, '|', 1)::uuid as id, split_part(b, '|', 2) as code,
                             split_part(b, '|', 3)::timestamptz as at, split_part(b, '|', 4)::boolean as late
                        from unnest(string_to_array(v_badges, ';')) b) q
               order by q.id, q.code, q.at) e) x
     order by x.id, x.step, x.code
  loop
    if r.step = 0 then
      perform private.sync_level(r.id, false);
    else
      perform private.award_badge(r.id, r.code, r.at, false, true, r.late);
    end if;
  end loop;
  perform set_config('keepup.late_users', '', true);
end;
$$;


-- Copied from 20261014100000_streak_check_in_xp.sql (its latest definition). New: the streak bonus once per period, and the
-- author of a late check-in is marked for a late level_up (header).
create or replace function private.rewards_on_check_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_habit public.habits;
  v_upgrade boolean := false;
  v_late boolean;
  v_at timestamptz := case when tg_op = 'UPDATE' then coalesce(new.reviewed_at, new.created_at) else new.created_at end;
  v_amount int := 10;
begin
  if new.status <> 'approved' or (tg_op = 'UPDATE' and old.status = 'approved') then
    return new;
  end if;
  select h.* into v_habit from public.habits h where h.id = new.habit_id;
  -- Will this check-in upgrade a settled period (check_in_impl / review_check_in_impl call
  -- resettle_period right after, and it upgrades exactly when this holds)? Then the members' period
  -- grants follow, and everyone's levels are synced once, together, by the period trigger.
  if v_habit.id is not null and exists (select 1 from public.period_results x
              where x.habit_id = new.habit_id and x.period_start = new.period_start and x.outcome in ('missed', 'skipped', 'rested')) then
    v_upgrade := private.period_outcome(v_habit, new.period_start) = 'done';
  end if;
  if v_habit.id is not null then
    -- The streak bonus once per period: only while no other counted check-in of theirs stands in it.
    v_amount := 10 + case when exists (select 1 from public.check_ins c
                                        where c.habit_id = new.habit_id and c.user_id = new.user_id
                                          and c.period_start = new.period_start and c.status = 'approved' and c.id <> new.id)
                          then 0
                          else private.check_in_streak(v_habit, new.user_id, new.period_start, v_at, 20) end;
  end if;
  for r in
    select v.who, v.amount, v.reason
      from (values (new.user_id, v_amount, 'check_in'),
                   (case when tg_op = 'UPDATE' and new.reviewed_by is distinct from new.user_id then new.reviewed_by end,
                    2, 'approval')) v(who, amount, reason)
     where v.who is not null
     order by v.who
  loop
    perform private.grant_xp(r.who, r.amount, r.reason, 'check_in', new.id::text, new.habit_id, v_at, false, false);
  end loop;
  v_late := v_habit.id is not null and private.is_late_check_in(v_habit, new);
  if v_late then
    perform private.mark_late_levels(array[new.user_id]);
  end if;
  perform private.badges_on_check_in(new, false, false, v_late);
  if tg_op = 'UPDATE' then
    perform private.badges_on_review(new, false, false);
  end if;
  if not v_upgrade and current_setting('keepup.defer_levels', true) is distinct from 'on' then
    perform private.sync_deferred_levels(); -- author and reviewer, in user id order (levels, then badges)
  end if;
  return new;
end;
$$;

-- A person's own outcome of a group habit's period, as check_in_streak judges it: done when their own
-- approved check-ins reach the target; skipped when they weren't required or the period was skipped;
-- open while an approval habit's period waits out its grace; else missed.
create function private.own_outcome(p_habit public.habits, p_user uuid, p_period_start date, p_at timestamptz)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_out text;
begin
  select x.outcome into v_out from public.period_results x where x.habit_id = p_habit.id and x.period_start = p_period_start;
  if p_user not in (select m from private.required_members(p_habit, p_period_start) m) then
    return 'skipped';
  elsif (select count(*) from public.check_ins c
          where c.habit_id = p_habit.id and c.user_id = p_user and c.period_start = p_period_start and c.status = 'approved') >= p_habit.target_count then
    return 'done';
  elsif coalesce(v_out, private.period_outcome(p_habit, p_period_start)) = 'skipped' then
    return 'skipped';
  elsif v_out is null and private.in_grace(p_habit, p_period_start, p_at) then
    return 'open';
  end if;
  return 'missed';
end;
$$;

-- Back on track, own part: walking back from p_period_start, an own miss with an own done before it
-- (an earlier streak of theirs ended).
create function private.own_comeback(p_habit public.habits, p_user uuid, p_period_start date, p_at timestamptz)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_step interval := private.period_step(p_habit.period);
  v_first date := private.first_period_start(p_habit);
  v_ps date := p_period_start;
  v_missed boolean := false;
  v_out text;
begin
  while v_ps >= v_first loop
    v_out := private.own_outcome(p_habit, p_user, v_ps, p_at);
    if v_out = 'missed' then
      v_missed := true;
    elsif v_out = 'done' and v_missed then
      return true;
    end if;
    v_ps := (v_ps::timestamp - v_step)::date;
  end loop;
  return false;
end;
$$;

-- Copied from 20261012100000_rest_days.sql (its latest definition). New: a group habit's streak badges
-- (First week, Two weeks strong, Unstoppable, Century, Year-round, Free, Hydrated, Back on track) read
-- each member's own streak (check_in_streak), at any settle of a period whose own part they did; the
-- group run (streak_at) now judges them for private habits only. Milestones stay on the group run.
create or replace function private.badges_on_period(p_habit public.habits, p_period_start date, p_outcome text, p_at timestamptz default now(),
  p_quiet boolean default false, p_sync boolean default true, p_late boolean default false)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_run int;
  v_start date;
  v_week date;
  v_profile public.profiles;
  v_month date := date_trunc('month', p_period_start::timestamp)::date;
  v_next date := (date_trunc('month', p_period_start::timestamp) + interval '1 month')::date;
  v_count int;
  v_need int;
  v_code text;
  v_own int;
  v_cap int;
  u uuid;
begin
  if p_habit.period in ('day', 'week') then
    for u in
      select x.id
        from (select p_habit.owner_id as id where p_habit.group_id is null
              union
              select m.profile_id from private.required_members(p_habit, p_period_start) m(profile_id) where p_habit.group_id is not null) x
       where x.id is not null
       order by x.id
    loop
      select p.* into v_profile from public.profiles p where p.id = u;
      v_week := private.period_start('week', p_period_start, v_profile.week_start);
      -- Only once the week is over in this habit's zone (no earlier settle of it can complete the
      -- week; the person's other habits re-judge at their own settles), and not again.
      continue when p_at < private.local_midnight(v_week + 7, private.habit_timezone(p_habit))
                 or exists (select 1 from public.user_achievements a where a.user_id = u and a.achievement_code = 'perfect_week');
      if p_sync or p_quiet then
        if private.perfect_week(u, v_week, p_at) then
          perform private.award_badge(u, 'perfect_week', p_at, p_quiet, p_sync, p_late);
        end if;
      elsif strpos(';' || coalesce(current_setting('keepup.unjudged', true), ''), ';' || u || '|' || v_week || '|') = 0 then
        -- Judged once per person and week by sync_deferred_levels, after everything this transaction settles.
        perform set_config('keepup.unjudged',
          coalesce(nullif(current_setting('keepup.unjudged', true), '') || ';', '') || u || '|' || v_week || '|' || coalesce(p_at, now()) || '|' || p_late, true);
      end if;
    end loop;
  end if;
  -- A group habit's streak badges read each member's own streak (owner 2026-10-06: your own part, as
  -- for Perfect week, XP, This week and the calendar), judged at any settle of a period whose own part
  -- they did (another member's miss doesn't settle it done). Walked back only as far as the largest
  -- threshold still to earn.
  if p_habit.group_id is not null then
    for u in select m.profile_id from private.required_members(p_habit, p_period_start) m(profile_id) order by 1 loop
      continue when (select count(*) from public.check_ins c
                      where c.habit_id = p_habit.id and c.user_id = u and c.period_start = p_period_start
                        and c.status = 'approved') < p_habit.target_count;
      select max(t.n) into v_cap
        from (values ('first_week', 7, true), ('back_on_track', 7, true),
                     ('two_weeks_strong', 14, p_habit.period = 'day'), ('unstoppable', 30, p_habit.period = 'day'),
                     ('century', 100, p_habit.period = 'day'), ('year_round', 365, p_habit.period = 'day'),
                     ('free', 30, p_habit.period = 'day' and p_habit.category = 'break_habit'),
                     ('hydrated', 7, p_habit.period = 'day' and p_habit.category = 'health' and p_habit.target_count >= 8)) t(code, n, applies)
       where t.applies
         and not exists (select 1 from public.user_achievements a where a.user_id = u and a.achievement_code = t.code);
      continue when v_cap is null;
      v_own := private.check_in_streak(p_habit, u, p_period_start, p_at, v_cap - 1) + 1;
      continue when v_own < 7;
      perform private.award_badge(u, 'first_week', p_at, p_quiet, p_sync, p_late);
      if p_habit.period = 'day' then
        if v_own >= 14 then perform private.award_badge(u, 'two_weeks_strong', p_at, p_quiet, p_sync, p_late); end if;
        if v_own >= 30 then perform private.award_badge(u, 'unstoppable', p_at, p_quiet, p_sync, p_late); end if;
        if v_own >= 100 then perform private.award_badge(u, 'century', p_at, p_quiet, p_sync, p_late); end if;
        if v_own >= 365 then perform private.award_badge(u, 'year_round', p_at, p_quiet, p_sync, p_late); end if;
        if v_own >= 30 and p_habit.category = 'break_habit' then perform private.award_badge(u, 'free', p_at, p_quiet, p_sync, p_late); end if;
        if p_habit.category = 'health' and p_habit.target_count >= 8 then
          perform private.award_badge(u, 'hydrated', p_at, p_quiet, p_sync, p_late);
        end if;
      end if;
      if not exists (select 1 from public.user_achievements a where a.user_id = u and a.achievement_code = 'back_on_track')
         and private.own_comeback(p_habit, u, p_period_start, p_at) then
        perform private.award_badge(u, 'back_on_track', p_at, p_quiet, p_sync, p_late);
      end if;
    end loop;
  end if;
  if p_outcome = 'rested' then
    perform private.award_badge(p_habit.owner_id, 'rest_well', p_at, p_quiet, p_sync, p_late);
    -- Full day was judged at the day's check-ins, before this rest day existed: judge the day again
    -- now that the rested habit is left out (queued from the trigger, like every other award).
    if p_habit.period = 'day' and private.full_day(p_habit.owner_id, p_period_start) then
      perform private.award_badge(p_habit.owner_id, 'full_day', p_at, p_quiet, p_sync, p_late);
    end if;
    return;
  end if;
  if p_outcome <> 'done' then
    return;
  end if;
  select s.run, s.started_on into v_run, v_start from private.streak_at(p_habit, p_period_start) s;
  for u in
    select x.user_id from public.xp_events x
     where x.habit_id = p_habit.id and x.reason = 'period_done' and x.source_type = 'period'
       and x.source_id = p_habit.id || ':' || p_period_start
     order by x.user_id
  loop
    -- Streak badges: private habits here (the group's are judged per member, above).
    if p_habit.group_id is null and v_run >= 7 then
      perform private.award_badge(u, 'first_week', p_at, p_quiet, p_sync, p_late);
    end if;
    if p_habit.group_id is null and p_habit.period = 'day' then
      if v_run >= 14 then perform private.award_badge(u, 'two_weeks_strong', p_at, p_quiet, p_sync, p_late); end if;
      if v_run >= 30 then perform private.award_badge(u, 'unstoppable', p_at, p_quiet, p_sync, p_late); end if;
      if v_run >= 100 then perform private.award_badge(u, 'century', p_at, p_quiet, p_sync, p_late); end if;
      if v_run >= 365 then perform private.award_badge(u, 'year_round', p_at, p_quiet, p_sync, p_late); end if;
      if v_run >= 30 and p_habit.category = 'break_habit' then perform private.award_badge(u, 'free', p_at, p_quiet, p_sync, p_late); end if;
      if v_run >= 7 and p_habit.category = 'health' and p_habit.target_count >= 8 then
        perform private.award_badge(u, 'hydrated', p_at, p_quiet, p_sync, p_late);
      end if;
    end if;
    -- Back on track: this streak is 7+ and an earlier streak on the habit ended (a missed period after a done one).
    if p_habit.group_id is null and v_run >= 7 and exists (
         select 1 from public.period_results m
          where m.habit_id = p_habit.id and m.outcome = 'missed' and m.period_start < v_start
            and exists (select 1 from public.period_results d where d.habit_id = p_habit.id and d.outcome = 'done' and d.period_start < m.period_start)) then
      perform private.award_badge(u, 'back_on_track', p_at, p_quiet, p_sync, p_late);
    end if;
    if (p_habit.period = 'week'
        and (select count(*) from public.period_results x where x.habit_id = p_habit.id and x.outcome = 'done'
              and x.period_start >= v_month and x.period_start < v_next) >= 4
        and not exists (select 1 from public.period_results x where x.habit_id = p_habit.id and x.outcome = 'missed'
              and x.period_start >= v_month and x.period_start < v_next))
       or (p_habit.period = 'month' and v_run >= 3) then
      perform private.award_badge(u, 'steady_month', p_at, p_quiet, p_sync, p_late);
    end if;
    if p_habit.category in ('mind', 'learning', 'people', 'work_money') then
      select count(*) into v_count from public.xp_events x join public.habits h on h.id = x.habit_id
       where x.user_id = u and x.reason = 'period_done' and h.category = p_habit.category and x.created_at <= p_at;
      v_need := case p_habit.category when 'people' then 10 when 'work_money' then 6 else 30 end;
      v_code := case p_habit.category when 'mind' then 'calm_mind' when 'learning' then 'bookworm'
                                      when 'people' then 'good_company' else 'go_getter' end;
      if v_count >= v_need then
        perform private.award_badge(u, v_code, p_at, p_quiet, p_sync, p_late);
      end if;
    end if;
    if p_habit.group_id is not null then
      perform private.award_badge(u, 'all_together', p_at, p_quiet, p_sync, p_late);
      if (select count(*) from public.xp_events x join public.habits h on h.id = x.habit_id
           where x.user_id = u and x.reason = 'period_done' and h.group_id is not null and x.created_at <= p_at) >= 10 then
        perform private.award_badge(u, 'team_player', p_at, p_quiet, p_sync, p_late);
      end if;
    end if;
  end loop;
end;
$$;

