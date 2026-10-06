-- M5 rest days (ideas/achievements-and-rewards.md §5; owner 2026-10-04: private habits only). A rest
-- day is earned by consecutive done periods and used automatically when finalization would write
-- `missed`: the period becomes `rested`, which keeps the streak but doesn't add to it (habit_streaks,
-- run_before, streak_at, reached_before and period_milestones already pass over anything that isn't
-- done or missed). Nothing is stored: the balance is read from period_results, so a late upgrade of a
-- rested day refunds it by itself. Past missed periods stay missed (no backfill). Group and monthly
-- habits have none; a paused period is skipped and never uses one.
-- Controller ruling (2026-10-06): a rested period counts like skipped for Perfect week, Full day and
-- Steady month (review, fix round 1).
-- By design, a refund is not re-applied: when a late upgrade gives a rest day back, a later period
-- already settled as missed stays missed (its "streak ended" note can't be retracted), and the
-- rest_day_used note of the upgraded day stays in the Inbox.
-- Replaced, copied from their latest definitions:
--   period_results_outcome_check        20260929100400_period_results_and_streaks.sql
--   private.finalize_periods            20261009100000_xp_ledger.sql
--   private.resettle_period             20261007100000_m4_final_fixes.sql
--   private.full_day                    20261011100000_badges.sql
--   private.perfect_week                20261011100000_badges.sql
--   private.rewards_on_check_in         20261011100000_badges.sql
--   private.rewards_on_period_result    20261011100000_badges.sql
--   private.badges_on_period            20261011100000_badges.sql
--
-- Locks: unchanged (habit → check-in → period_results → per-habit rows → per-person rows, in user id
-- order). rest_days_left / settled_outcome only read. finalize_periods still runs its habit loop under
-- keepup.defer_levels and syncs once after it; a rested settle writes only per-habit rows in the loop
-- (the rest_day_used note, keyed by habit and period) and queues Rest well and a re-judged Full day. A late tap on a rested day
-- is predicted as an upgrade by rewards_on_check_in, so the author's levels and badges wait for the
-- period trigger's one sync, after resettle_period has taken the period_results row.

alter table public.period_results drop constraint period_results_outcome_check;
alter table public.period_results add constraint period_results_outcome_check check (outcome in ('done', 'missed', 'skipped', 'rested'));

-- Saved rest days before a period: daily habits earn one per 7 consecutive done days, weekly habits
-- one per 4 done weeks, at most 2 saved. A rested period uses one and restarts the count; a missed one
-- ends the streak and its saved days; skipped (paused, not started, after the end) passes over.
-- Group and monthly habits: none.
create function private.rest_days_left(p_habit public.habits, p_before date)
returns int
language plpgsql
stable
set search_path = ''
as $$
declare
  v_every int := case p_habit.period when 'day' then 7 when 'week' then 4 end;
  v_left int := 0;
  v_run int := 0;
  r record;
begin
  if v_every is null or p_habit.group_id is not null then
    return 0;
  end if;
  for r in select x.outcome from public.period_results x
            where x.habit_id = p_habit.id and x.period_start < p_before
            order by x.period_start loop
    if r.outcome = 'done' then
      v_run := v_run + 1;
      if v_run % v_every = 0 then
        v_left := least(v_left + 1, 2);
      end if;
    elsif r.outcome = 'rested' then
      v_left := greatest(v_left - 1, 0);
      v_run := 0;
    elsif r.outcome = 'missed' then
      v_left := 0;
      v_run := 0;
    end if;
  end loop;
  return v_left;
end;
$$;

-- The outcome finalization writes: period_outcome, with missed → rested when a rest day is saved.
create function private.settled_outcome(p_habit public.habits, p_period_start date)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_outcome text := private.period_outcome(p_habit, p_period_start);
begin
  if v_outcome = 'missed' and private.rest_days_left(p_habit, p_period_start) > 0 then
    return 'rested';
  end if;
  return v_outcome;
end;
$$;

-- Copied from 20261009100000_xp_ledger.sql (its latest definition). New: periods are settled one at a
-- time, oldest first, each by its own statement, so a catch-up of several missed days sees the rest
-- day the first one used (rested, missed, missed); settled_outcome replaces period_outcome. The
-- keepup.defer_levels flag and the one sync after the loop are unchanged.
create or replace function private.finalize_periods(p_now timestamptz)
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_habit public.habits;
  v_step interval;
  v_current date;
  v_last date;
  v_ps date;
  v_inserted int;
  v_total int := 0;
begin
  perform set_config('keepup.defer_levels', 'on', true);
  for v_habit in
    select h.* from public.habits h
     where h.archived_at is null
        or exists (select 1 from public.check_ins c where c.habit_id = h.id and c.status = 'pending')
     order by h.id
  loop
    -- Archived habits aren't finalized, but a pending check-in on one still expires once its review
    -- window has passed (it can no longer be reviewed).
    if v_habit.archived_at is not null then
      if exists (select 1 from public.check_ins c
                  where c.habit_id = v_habit.id and c.status = 'pending'
                    and p_now >= private.check_in_deadline(v_habit, c)) then
        perform 1 from public.habits h where h.id = v_habit.id for update;
        update public.check_ins c set status = 'expired'
         where c.habit_id = v_habit.id and c.status = 'pending'
           and p_now >= private.check_in_deadline(v_habit, c);
      end if;
      continue;
    end if;

    v_step := private.period_step(v_habit.period);
    v_current := private.habit_period_start(v_habit, private.habit_today(v_habit, p_now));
    v_last := (v_current::timestamp - v_step)::date;
    -- Periods are at least a day long, so only the one just closed can still be in its 12h grace.
    if private.in_grace(v_habit, v_last, p_now) then
      v_last := (v_last::timestamp - v_step)::date;
    end if;

    if exists (select 1 from public.check_ins c
                where c.habit_id = v_habit.id and c.status = 'pending' and c.period_start <= v_last
                  and p_now >= private.check_in_deadline(v_habit, c)) then
      perform 1 from public.habits h where h.id = v_habit.id for update;
      update public.check_ins c set status = 'expired'
       where c.habit_id = v_habit.id and c.status = 'pending' and c.period_start <= v_last
         and p_now >= private.check_in_deadline(v_habit, c);
    end if;

    if exists (select 1
                 from generate_series(private.first_period_start(v_habit)::timestamp, v_last::timestamp, v_step) as s(d)
                where not exists (
                  select 1 from public.period_results x where x.habit_id = v_habit.id and x.period_start = s.d::date)) then
      perform 1 from public.habits h where h.id = v_habit.id for update;
    end if;

    -- One period per statement, oldest first: each settle sees the ones before it (rest_days_left
    -- reads period_results), so a catch-up uses a saved rest day once.
    for v_ps in
      select s.d::date
        from generate_series(private.first_period_start(v_habit)::timestamp, v_last::timestamp, v_step) as s(d)
       where not exists (
         select 1 from public.period_results x where x.habit_id = v_habit.id and x.period_start = s.d::date)
       order by 1
    loop
      insert into public.period_results (habit_id, period_start, outcome, finalized_at)
      values (v_habit.id, v_ps, private.settled_outcome(v_habit, v_ps), p_now)
      on conflict (habit_id, period_start) do nothing;
      get diagnostics v_inserted = row_count;
      v_total := v_total + v_inserted;
    end loop;
  end loop;
  perform set_config('keepup.defer_levels', '', true);
  perform private.sync_deferred_levels();
  return v_total;
end;
$$;

-- Copied from 20261007100000_m4_final_fixes.sql (its latest definition). New: a rested period is
-- upgraded too (its rest day comes back: rest_days_left reads the new outcome). "Streak is back"
-- still follows only a missed one (a rested day sent no "ended" note). The refund isn't re-applied to
-- a later period already settled missed, and the day's rest_day_used note stays (header).
create or replace function private.resettle_period(p_habit public.habits, p_period_start date)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_old text;
  v_streak int;
begin
  select r.outcome into v_old from public.period_results r
   where r.habit_id = p_habit.id and r.period_start = p_period_start for update;
  if v_old is null or v_old not in ('missed', 'skipped', 'rested') or private.period_outcome(p_habit, p_period_start) <> 'done' then
    return;
  end if;
  update public.period_results set outcome = 'done' where habit_id = p_habit.id and period_start = p_period_start;
  if v_old <> 'missed' then
    return;
  end if;
  -- The "ended" note is found by its exact dedupe keys (the unique index on dedupe_key): one per
  -- recipient, so for a group every member it may have reached, past members included.
  if p_habit.group_id is not null then
    select max(case when n.payload ->> 'streak' ~ '^\d{1,9}$' then (n.payload ->> 'streak')::int else 0 end) into v_streak
      from public.notifications n
     where n.dedupe_key = any (array(
       select 'group_streak_ended:' || p_habit.id || ':' || p_period_start || ':' || m.user_id
         from public.group_members m where m.group_id = p_habit.group_id));
    if v_streak >= 3 then
      perform private.notify(private.group_adults(p_habit.group_id, array[auth.uid()]), 'streak_back',
        'streak_back:' || p_habit.id || ':' || p_period_start, p_habit.group_id, p_habit.id, null, null, null,
        jsonb_build_object('period_start', p_period_start));
    end if;
  elsif exists (select 1 from public.notifications n
                 where n.dedupe_key = 'private_streak_ended:' || p_habit.id || ':' || p_period_start || ':' || p_habit.owner_id) then
    perform private.notify(array[p_habit.owner_id], 'streak_back',
      'streak_back:' || p_habit.id || ':' || p_period_start, null, p_habit.id, null, null, null,
      jsonb_build_object('period_start', p_period_start));
  end if;
end;
$$;

-- Copied from 20261011100000_badges.sql (its latest definition). New: a daily habit whose day was
-- rested is left out, like a paused one (controller ruling). Full day is judged at the check-in,
-- before finalization decides rested, so badges_on_period judges the day again on a rested settle.
create or replace function private.full_day(p_user uuid, p_date date)
returns boolean
language sql
stable
set search_path = ''
as $$
  with due as (
    select h.id, h.target_count
      from public.habits h
     where h.period = 'day' and h.archived_at is null
       and h.starts_on <= p_date and (h.ends_on is null or h.ends_on >= p_date)
       and (h.owner_id = p_user or h.id in (select private.person_group_habits(p_user)))
       and not private.is_frozen(h.id, p_date, p_date + 1)
       and not private.is_member_frozen(h.id, p_user, p_date, p_date + 1)
       and not exists (select 1 from public.period_results r
                        where r.habit_id = h.id and r.period_start = p_date and r.outcome = 'rested'))
  select count(*) >= 2 and coalesce(bool_and((
           select count(*) from public.check_ins c
            where c.habit_id = d.id and c.user_id = p_user and c.local_date = p_date and c.status = 'approved') >= d.target_count), false)
    from due d;
$$;

-- Copied from 20261011100000_badges.sql (its latest definition). New: a private habit's rested period
-- passes like skipped (controller ruling: a rest day doesn't break Perfect week; it isn't done
-- either). Group habits never rest.
create or replace function private.perfect_week(p_user uuid, p_week_start date, p_now timestamptz default now())
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  h public.habits;
  v_ps date;
  v_current date;
  v_counted boolean;
  v_done boolean;
  v_habits_done int := 0;
  v_out text;
begin
  for h in
    select x.* from public.habits x
     where x.period in ('day', 'week')
       and (x.owner_id = p_user or x.id in (select private.person_group_habits(p_user)))
       and x.starts_on <= p_week_start
       and (x.ends_on is null or x.ends_on >= p_week_start + 6)
       and (x.archived_at is null or x.archived_at >= private.local_midnight(p_week_start + 7, private.habit_timezone(x)))
     order by x.group_id is not null, x.id
  loop
    v_counted := false;
    v_done := false;
    v_current := private.habit_period_start(h, private.habit_today(h, p_now));
    for v_ps in
      select distinct private.habit_period_start(h, d::date)
        from generate_series(p_week_start::timestamp, (p_week_start + 6)::timestamp, interval '1 day') d
       where h.period = 'day' or private.habit_period_start(h, d::date) >= p_week_start
       order by 1
    loop
      if h.group_id is null then
        select x.outcome into v_out from public.period_results x where x.habit_id = h.id and x.period_start = v_ps;
        if v_out is null or v_out not in ('done', 'skipped', 'rested') then
          return false;
        end if;
        v_counted := true;
        v_done := v_done or v_out = 'done';
      elsif (select count(*) from public.check_ins c
              where c.habit_id = h.id and c.user_id = p_user and c.period_start = v_ps and c.status = 'approved') >= h.target_count then
        -- Own part done: 'done' if they were required for it, else left out. One is enough per habit.
        if not v_done and p_user in (select m from private.required_members(h, v_ps) m) then
          v_counted := true;
          v_done := true;
        end if;
      elsif p_user in (select m from private.required_members(h, v_ps) m) then
        if v_ps = v_current or coalesce(
             (select x.outcome from public.period_results x where x.habit_id = h.id and x.period_start = v_ps),
             private.period_outcome(h, v_ps)) <> 'skipped' then
          return false; -- open, or missed
        end if;
        v_counted := true;
      end if;
    end loop;
    if v_counted and v_done then
      v_habits_done := v_habits_done + 1;
    end if;
  end loop;
  return v_habits_done >= 2;
end;
$$;

-- Copied from 20261011100000_badges.sql (its latest definition). New: a late tap on a rested period
-- is an upgrade too (resettle_period now takes rested), so its author's levels and badges are synced
-- once by the period trigger, after the period_results row is locked (Locks, at the top).
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
begin
  if new.status <> 'approved' or (tg_op = 'UPDATE' and old.status = 'approved') then
    return new;
  end if;
  -- Will this check-in upgrade a settled period (check_in_impl / review_check_in_impl call
  -- resettle_period right after, and it upgrades exactly when this holds)? Then the members' period
  -- grants follow, and everyone's levels are synced once, together, by the period trigger.
  if exists (select 1 from public.period_results x
              where x.habit_id = new.habit_id and x.period_start = new.period_start and x.outcome in ('missed', 'skipped', 'rested')) then
    select h.* into v_habit from public.habits h where h.id = new.habit_id;
    v_upgrade := private.period_outcome(v_habit, new.period_start) = 'done';
  end if;
  for r in
    select v.who, v.amount, v.reason
      from (values (new.user_id, 10, 'check_in'),
                   (case when tg_op = 'UPDATE' and new.reviewed_by is distinct from new.user_id then new.reviewed_by end,
                    2, 'approval')) v(who, amount, reason)
     where v.who is not null
     order by v.who
  loop
    perform private.grant_xp(r.who, r.amount, r.reason, 'check_in', new.id::text, new.habit_id,
      case when tg_op = 'UPDATE' then coalesce(new.reviewed_at, new.created_at) else new.created_at end,
      false, false);
  end loop;
  if v_habit.id is null then
    select h.* into v_habit from public.habits h where h.id = new.habit_id;
  end if;
  v_late := v_habit.id is not null and private.is_late_check_in(v_habit, new);
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

-- Copied from 20261011100000_badges.sql (its latest definition). New: a rested period writes the
-- rest_day_used Inbox row for an adult owner, { streak: the run kept, period }. Rest well and the
-- re-judged Full day are queued by badges_on_period (any non-done outcome already reaches it, queued,
-- at v_at).
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

-- Copied from 20261011100000_badges.sql (its only definition). New: a rested settle re-judges Full day
-- for that date (the rested habit is now left out), and Steady month treats a rested week like a
-- skipped one (only missed breaks it). Called with p_sync = false from the trigger, so both are queued
-- and written after finalize's loop, per person in user id order.
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
    if v_run >= 7 then
      perform private.award_badge(u, 'first_week', p_at, p_quiet, p_sync, p_late);
    end if;
    if p_habit.period = 'day' then
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
    if v_run >= 7 and exists (
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
