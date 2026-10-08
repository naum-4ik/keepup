-- Final-review fixes to habit ends (20260930150000_habit_end_date.sql).
--   D1: the finish summary's guard let an outsider through on a group habit (owner_id is null, so
--       "owner_id = actor or ..." was null, and "not null" is null, which "if" treats as false).
--       It now asks private.habit_role, which is null exactly for someone with no part in the habit.
--   D2: a habit's short last period (ends_on before the period's last day) is never missed: done if
--       finished, else skipped. It mirrors the partial first period.
--   D3: once the end has passed, the end can't be changed or removed; only Keep going or Finish.

-- Same as 20260930150000_habit_end_date.sql, plus the short-last-period rule next to the first-period one.
create or replace function private.period_outcome(p_habit public.habits, p_period_start date)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_done int;
  v_required int;
  v_short int;
begin
  -- After the end (20260930150000): nothing more is due, so the period neither adds nor breaks.
  if p_habit.ends_on is not null and p_period_start > private.habit_period_start(p_habit, p_habit.ends_on) then
    return 'skipped';
  end if;
  if p_habit.group_id is null then
    select count(*) into v_done from public.check_ins c
     where c.habit_id = p_habit.id and c.period_start = p_period_start and c.status = 'approved';
    if v_done >= p_habit.target_count then
      return 'done';
    end if;
  else
    select count(*), count(*) filter (where n.cnt < p_habit.target_count)
      into v_required, v_short
      from private.required_members(p_habit, p_period_start) r(profile_id)
      cross join lateral (
        select count(*)::int as cnt from public.check_ins c
         where c.habit_id = p_habit.id and c.user_id = r.profile_id
           and c.period_start = p_period_start and c.status = 'approved') n;
    if v_required = 0 then
      return 'skipped';
    end if;
    if v_short = 0 then
      return 'done';
    end if;
  end if;
  if private.is_frozen(p_habit.id, p_period_start, private.period_end(p_habit.period, p_period_start)) then
    return 'skipped';
  end if;
  if p_period_start = private.first_period_start(p_habit) then
    return 'skipped';
  end if;
  -- The short last period (20260930180000): the end cut it off before its last day (period_end is
  -- the day after), so it may not have had room for the target.
  if p_habit.ends_on is not null
     and p_period_start = private.habit_period_start(p_habit, p_habit.ends_on)
     and p_habit.ends_on < private.period_end(p_habit.period, p_period_start) - 1 then
    return 'skipped';
  end if;
  return 'missed';
end;
$$;

-- Same as 20260930150000_habit_end_date.sql, plus: after the end, the end is fixed.
create or replace function private.set_habit_end_impl(p_actor uuid, p_habit_id uuid, p_ends_on date, p_now timestamptz)
returns public.habits
language plpgsql
set search_path = ''
as $$
declare
  v_habit public.habits := private.habit_for_update(p_habit_id);
begin
  perform private.require_habit_manager(p_actor, v_habit);
  if v_habit.archived_at is not null then
    raise exception 'keepup:habit_archived' using errcode = 'P0001';
  end if;
  if v_habit.ends_on is not null and private.habit_today(v_habit, p_now) > v_habit.ends_on then
    raise exception 'keepup:end_passed' using errcode = 'P0001';
  end if;
  if p_ends_on is not null and (p_ends_on < private.habit_today(v_habit, p_now) or p_ends_on < v_habit.ends_on) then
    raise exception 'keepup:end_too_early' using errcode = 'P0001';
  end if;
  update public.habits set ends_on = p_ends_on where id = p_habit_id returning * into v_habit;
  return v_habit;
end;
$$;

-- Same as 20260930150000_habit_end_date.sql, with the guard on private.habit_role (never null for
-- someone who takes part; null, so refused, for anyone else).
create or replace function private.habit_finish_summary_impl(p_actor uuid, p_habit_id uuid, p_now timestamptz)
returns table (done int, total int, best_streak int)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_habit public.habits;
  v_step interval;
  v_last date;
begin
  select h.* into v_habit from public.habits h where h.id = p_habit_id;
  if not found or v_habit.ends_on is null or private.habit_role(v_habit, p_actor) is null then
    raise exception 'keepup:habit_not_found' using errcode = 'P0002';
  end if;
  v_step := private.period_step(v_habit.period);
  v_last := private.habit_period_start(v_habit, v_habit.ends_on);
  return query
    with outcomes as (
      select coalesce(x.outcome, private.period_outcome(v_habit, s.d::date)) as outcome
        from generate_series(private.first_period_start(v_habit)::timestamp, v_last::timestamp, v_step) as s(d)
        left join public.period_results x on x.habit_id = v_habit.id and x.period_start = s.d::date)
    select (count(*) filter (where o.outcome = 'done'))::int,
           (count(*) filter (where o.outcome in ('done', 'missed')))::int,
           (select b.best_streak from private.habit_streaks(v_habit.id, p_now) b)
      from outcomes o;
end;
$$;
