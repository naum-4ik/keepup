-- M5 streak milestones (ideas/achievements-and-rewards.md §2; owner 2026-10-04: Inbox rows and pushes,
-- not Today cards). Once per streak: the key is <habit>:<first done period of the streak>:<n>, kept in
-- the ledger (the feed is purged after 60 days). They fire when a period settles done and when a late
-- check-in upgrades one (resettle_period's UPDATE), walking forward over the later settled days the
-- merged streak now reaches. Replaced functions are copied from their latest definitions:
--   private.rewards_on_period_result   20261009100000_xp_ledger.sql
--   private.feed_on_period_result      20261002100000_notification_prefs_push.sql
--   private.push_allowed               20261009100000_xp_ledger.sql
--
-- Locks: unchanged from 20261009100000_xp_ledger.sql (habit → check-in → period_results → per-habit
-- rows → per-person rows, in user id order). Milestones only read period_results and the ledger, and
-- write per-habit rows (xp_events keyed `<habit>:<start>:<n>`, notifications deduped by that key); their
-- grants defer levels (p_sync = false), which the period trigger syncs together with everyone else's,
-- or finalize_periods / review_check_ins / check_in_with sync after their loop (keepup.defer_levels).
--
-- Late upgrades follow the late rule (20261006100000_offline_check_ins.sql): when the check-in that made
-- the period done arrived after its period, the milestone rows carry late = true; group_milestone and
-- kid_streak then stay in the Inbox (push_allowed), streak_milestone pushes per Achievements delivery.

create function private.milestone_bonus(p_period public.habit_period, p_n int)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_period
    when 'day' then case p_n when 1 then 5 when 2 then 5 when 5 then 10 when 7 then 25 when 10 then 15 when 14 then 40
                             when 30 then 100 when 50 then 150 when 100 then 300 when 200 then 500 when 365 then 1000 end
    when 'week' then case p_n when 1 then 10 when 2 then 15 when 4 then 50 when 8 then 80 when 12 then 120 when 26 then 300 when 52 then 1000 end
    when 'month' then case p_n when 1 then 20 when 3 then 100 when 6 then 250 when 12 then 1000 end
  end;
$$;

-- The streak ending at a settled period, counted like private.habit_streaks: done adds, skipped and
-- rested pass over, missed stops. started_on: the streak's first done period (its identity).
create function private.streak_at(p_habit public.habits, p_period_start date)
returns table (run int, started_on date)
language plpgsql
stable
set search_path = ''
as $$
declare
  r record;
begin
  run := 0;
  started_on := null;
  for r in select x.period_start, x.outcome from public.period_results x
            where x.habit_id = p_habit.id and x.period_start <= p_period_start
            order by x.period_start desc loop
    exit when r.outcome = 'missed';
    if r.outcome = 'done' then
      run := run + 1;
      started_on := r.period_start;
    end if;
  end loop;
  return next;
end;
$$;

-- "Back to N": an EARLIER streak of this habit (one that started before p_started_on) reached N, by
-- the ledger or by the settled periods themselves. The periods make it independent of the order in
-- which one statement's period_results triggers fire (a finalize catch-up), and the ledger keeps it
-- for a milestone already paid.
create function private.reached_before(p_habit public.habits, p_started_on date, p_n int)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_run int := 0;
  r record;
begin
  if exists (select 1 from public.xp_events x
              where x.habit_id = p_habit.id and x.reason = 'milestone'
                and split_part(x.source_id, ':', 3) = p_n::text
                and split_part(x.source_id, ':', 2)::date < p_started_on) then
    return true;
  end if;
  for r in select x.outcome from public.period_results x
            where x.habit_id = p_habit.id and x.period_start < p_started_on
            order by x.period_start loop
    if r.outcome = 'missed' then
      v_run := 0;
    elsif r.outcome = 'done' then
      v_run := v_run + 1;
      if v_run >= p_n then
        return true;
      end if;
    end if;
  end loop;
  return false;
end;
$$;

-- One milestone: the bonus to the owner (or each required member of a group period, in user id
-- order), then, if any grant was new and it isn't quiet, the Inbox row: streak_milestone for an adult's
-- own habit (with "back" when this habit reached this N in an earlier streak), group_milestone for a
-- group (every current adult), kid_streak to a child's adults (daily, from 7).
-- Not when this N was already reached in this same streak under another start: a late upgrade before
-- the streak's first done period moves its start, and that must not pay N twice.
create function private.award_milestone(
  p_habit public.habits, p_period_start date, p_run int, p_started_on date,
  p_at timestamptz default now(), p_quiet boolean default false, p_sync boolean default true,
  p_late boolean default false)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_bonus int := private.milestone_bonus(p_habit.period, p_run);
  v_key text := p_habit.id || ':' || p_started_on || ':' || p_run;
  v_any boolean := false;
  v_child_group uuid;
  v_late jsonb := case when p_late then jsonb_build_object('late', true) else '{}'::jsonb end;
  r record;
begin
  if v_bonus is null or p_started_on is null then
    return false;
  end if;
  -- (The streak runs from p_started_on to its next missed period, if any.)
  if exists (select 1 from public.xp_events x
              where x.habit_id = p_habit.id and x.reason = 'milestone' and x.source_id <> v_key
                and split_part(x.source_id, ':', 3) = p_run::text
                and split_part(x.source_id, ':', 2)::date >= p_started_on
                and split_part(x.source_id, ':', 2)::date < coalesce(
                  (select min(m.period_start) from public.period_results m
                    where m.habit_id = p_habit.id and m.period_start > p_started_on and m.outcome = 'missed'),
                  'infinity'::date)) then
    return false;
  end if;
  for r in
    select u.id
      from (select p_habit.owner_id as id where p_habit.group_id is null
            union
            select m.profile_id from private.required_members(p_habit, p_period_start) m(profile_id) where p_habit.group_id is not null) u
     where u.id is not null
     order by u.id
  loop
    if private.grant_xp(r.id, v_bonus, 'milestone', 'streak', v_key, p_habit.id, p_at, p_quiet, p_sync) then
      v_any := true;
    end if;
  end loop;
  if not v_any or p_quiet then
    return v_any;
  end if;

  if p_habit.group_id is not null then
    perform private.notify(private.group_adults(p_habit.group_id, null), 'group_milestone', 'group_milestone:' || v_key,
      p_habit.group_id, p_habit.id, null, null, null, jsonb_build_object('streak', p_run, 'period', p_habit.period) || v_late);
    return true;
  end if;

  v_child_group := private.child_group(p_habit.owner_id);
  if v_child_group is not null then
    if p_habit.period = 'day' and p_run >= 7 then
      perform private.notify(private.group_adults(v_child_group, null), 'kid_streak', 'kid_streak:' || v_key,
        v_child_group, p_habit.id, null, null, p_habit.owner_id, jsonb_build_object('streak', p_run) || v_late);
    end if;
    return true;
  end if;

  perform private.notify(array[p_habit.owner_id], 'streak_milestone', 'streak_milestone:' || v_key, null, p_habit.id, null, null, null,
    jsonb_build_object('streak', p_run, 'period', p_habit.period, 'back', private.reached_before(p_habit, p_started_on, p_run)) || v_late);
  return true;
end;
$$;

-- From a period that just settled done (or was upgraded to done) forward to the next missed one: each
-- done period's run is checked against the schedule. Already-granted milestones are no-ops (ledger key).
create function private.period_milestones(
  p_habit public.habits, p_period_start date, p_at timestamptz default now(), p_quiet boolean default false,
  p_sync boolean default true, p_late boolean default false)
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_run int;
  v_start date;
  v_n int := 0;
  r record;
begin
  select s.run, s.started_on into v_run, v_start from private.streak_at(p_habit, p_period_start) s;
  for r in select x.period_start, x.outcome from public.period_results x
            where x.habit_id = p_habit.id and x.period_start >= p_period_start
            order by x.period_start loop
    exit when r.outcome = 'missed';
    continue when r.outcome <> 'done';
    if r.period_start > p_period_start then
      v_run := v_run + 1;
      v_start := coalesce(v_start, r.period_start);
    end if;
    if private.award_milestone(p_habit, r.period_start, v_run, v_start, p_at, p_quiet, p_sync, p_late) then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$$;

-- Copied from 20261009100000_xp_ledger.sql (its latest definition). New: a done period also checks
-- milestones (deferred levels, synced with the rest below), late when the check-in that upgraded it
-- arrived after its period.
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
  end if;
  -- Levels are synced once for everyone paid, in user id order: inside finalize's habit loop, after
  -- the loop (finalize does it); otherwise now, together with an upgrading check-in's author and
  -- reviewer, deferred by rewards_on_check_in (Locks, at the top).
  if current_setting('keepup.defer_levels', true) is distinct from 'on' then
    perform private.sync_deferred_levels();
  end if;
  return new;
end;
$$;

-- Copied from 20261002100000_notification_prefs_push.sql (its latest definition). The group_milestone
-- and kid_streak branches moved to private.award_milestone (once per streak, also on an upgrade); the
-- streak-ended notes are unchanged.
create or replace function private.feed_on_period_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_habit public.habits;
  v_run int;
begin
  select h.* into v_habit from public.habits h where h.id = new.habit_id;
  if not found then
    return new;
  end if;

  if v_habit.group_id is not null then
    if new.outcome = 'missed' then
      v_run := private.run_before(v_habit, new.period_start);
      if v_run > 0 then
        perform private.notify(private.group_adults(v_habit.group_id, null), 'group_streak_ended',
          'group_streak_ended:' || v_habit.id || ':' || new.period_start, v_habit.group_id, v_habit.id, null, null, null,
          jsonb_build_object('streak', v_run, 'period', v_habit.period));
      end if;
    end if;
    return new;
  end if;

  if private.child_group(v_habit.owner_id) is null then
    if new.outcome = 'missed' then
      v_run := private.run_before(v_habit, new.period_start);
      if v_run > 0 then
        perform private.notify(array[v_habit.owner_id], 'private_streak_ended',
          'private_streak_ended:' || v_habit.id || ':' || new.period_start, null, v_habit.id, null, null, null,
          jsonb_build_object('streak', v_run, 'period', v_habit.period,
            'best', (select s.best_streak from private.habit_streaks(v_habit.id, new.finalized_at) s)));
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- Copied from 20261009100000_xp_ledger.sql (its latest definition). New: group_milestone and
-- kid_streak join the late clause (a late upgrade's group rows stay in the Inbox).
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
       and (p_kind not in ('group_check_in', 'everyone_done', 'kid_garden_full', 'group_milestone', 'kid_streak')
            or p_payload ->> 'late' is distinct from 'true')
      from (select private.push_category(p_kind) as category) c
      join public.profiles p on p.id = p_user
      left join public.habit_user_settings s on s.user_id = p_user and s.habit_id = p_habit_id
      left join public.notification_prefs np on np.user_id = p_user and np.category = c.category), false);
$$;

-- Past streaks (decided 2026-09-29), quietly: bonuses only, no Inbox rows. Grants defer levels; then
-- one quiet level pass (marked seen, no Inbox row) for everyone, as in private.backfill_xp. Any
-- deferral pending from the caller is kept. Idempotent (the ledger key); returns how many milestones
-- were new.
create function private.backfill_milestones()
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_pending text := current_setting('keepup.unsynced', true);
  v_habit public.habits;
  v_run int;
  v_start date;
  v_n int := 0;
  r record;
begin
  for v_habit in select h.* from public.habits h order by h.id loop
    v_run := 0;
    v_start := null;
    for r in select x.period_start, x.outcome, x.finalized_at from public.period_results x
              where x.habit_id = v_habit.id order by x.period_start loop
      if r.outcome = 'missed' then
        v_run := 0;
        v_start := null;
      elsif r.outcome = 'done' then
        v_run := v_run + 1;
        v_start := coalesce(v_start, r.period_start);
        if private.award_milestone(v_habit, r.period_start, v_run, v_start, r.finalized_at, true, false) then
          v_n := v_n + 1;
        end if;
      end if;
    end loop;
  end loop;
  perform set_config('keepup.unsynced', coalesce(v_pending, ''), true);

  insert into public.level_ups (user_id, level, seen_at)
  select t.user_id, l, now()
    from (select x.user_id, private.level_for(sum(x.amount)) as level from public.xp_events x group by x.user_id) t
   cross join lateral generate_series(2, t.level) l
  on conflict (user_id, level) do nothing;

  return v_n;
end;
$$;

select private.backfill_milestones();
-- Every level-up still unseen is marked seen too, so nobody gets a stale moment for a level they've
-- since passed.
update public.level_ups set seen_at = now() where seen_at is null;
