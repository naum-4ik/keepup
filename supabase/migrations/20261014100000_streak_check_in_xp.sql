-- Streak-scaled check-in XP (owner 2026-10-06): a counted check-in earns 10 + min(streak before it, 20),
-- so day 1 → +10, a 5-day streak → +15, 20 or more → +30. From now on only: existing xp_events (and
-- backfill_xp, which already ran) keep their +10. The reviewer's +2 is unchanged.
-- - streak before: the habit's run of done periods (in its own periods) that ends just before the
--   check-in's period, for the check-in's person: the own part of a group habit, a child too. Counted
--   like habit_streaks: done adds, skipped and rested pass over, a closed period still in its approval
--   grace passes over, missed stops. A late (offline) tap counts the streak as of its own period; a
--   pending check-in is paid when approved, with the streak of its period at that time.
-- - Idempotent: the same ledger key (a resend or a second trigger run pays nothing). Undo already
--   inserts the exact negative of the amount granted (xp_on_check_in_deleted looks it up), so it needs
--   no change.
-- Replaced, copied from its latest definition:
--   private.rewards_on_check_in   20261012100000_rest_days.sql
--
-- Locks: unchanged (habit → check-in → period_results → per-habit rows → per-person rows, in user id
-- order). private.check_in_streak only reads (no FOR UPDATE); the grant is the same deferred grant_xp.

-- The person's streak going into p_period_start, capped at p_cap (the loop stops there, so a long
-- streak costs at most p_cap done periods). Only periods before p_period_start are read, so neither
-- the check-in being paid nor a resettle of its own period changes the answer. p_at: the event's time
-- (the tap's arrival, or the approval), for the grace rule; never now(), so a test's pinned time holds.
-- A period not settled yet (finalize runs every 15 minutes; an approval habit waits out its grace) is
-- judged the way finalization will settle it: settled_outcome for a private habit (a rest day it would
-- use passes over), the person's own part for a group habit.
create function private.check_in_streak(p_habit public.habits, p_user uuid, p_period_start date, p_at timestamptz, p_cap int default 20)
returns int
language plpgsql
stable
set search_path = ''
as $$
declare
  v_step interval := private.period_step(p_habit.period);
  v_first date := private.first_period_start(p_habit);
  v_ps date := (p_period_start::timestamp - v_step)::date;
  v_run int := 0;
  v_out text;
begin
  while v_ps >= v_first and v_run < p_cap loop
    v_out := null;
    select x.outcome into v_out from public.period_results x where x.habit_id = p_habit.id and x.period_start = v_ps;
    if p_habit.group_id is null then
      if v_out is null then
        v_out := private.settled_outcome(p_habit, v_ps);
        if v_out <> 'done' and private.in_grace(p_habit, v_ps, p_at) then
          v_out := 'open';
        end if;
      end if;
    elsif p_user not in (select m from private.required_members(p_habit, v_ps) m) then
      v_out := 'skipped'; -- not part of it then (not yet a member, paused, not taking part): left out
    elsif (select count(*) from public.check_ins c
            where c.habit_id = p_habit.id and c.user_id = p_user and c.period_start = v_ps and c.status = 'approved') >= p_habit.target_count then
      v_out := 'done'; -- own part done, whatever the group's result
    elsif coalesce(v_out, private.period_outcome(p_habit, v_ps)) = 'skipped' then
      v_out := 'skipped';
    elsif v_out is null and private.in_grace(p_habit, v_ps, p_at) then
      v_out := 'open';
    else
      v_out := 'missed';
    end if;
    exit when v_out = 'missed';
    if v_out = 'done' then
      v_run := v_run + 1;
    end if;
    v_ps := (v_ps::timestamp - v_step)::date;
  end loop;
  return v_run;
end;
$$;

-- Copied from 20261012100000_rest_days.sql (its latest definition). New: the habit is read first, and
-- the author's 10 becomes 10 + check_in_streak (at most +20), at the event's time.
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
    v_amount := 10 + private.check_in_streak(v_habit, new.user_id, new.period_start, v_at, 20);
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
