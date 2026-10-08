-- Habits with an end date (ideas/habit-end-date.md): "every day for 30 days". The habit runs until
-- ends_on (the last day that counts, in the habit's calendar). After it: no more check-ins, the
-- periods after the end are "skipped" (they neither add to nor break a streak), and the owner (an
-- admin for group habits) chooses Keep going (the end is removed) or Finish (archived, marked
-- finished). The end can be set, extended or removed, never moved earlier than today.

alter table public.habits
  add column ends_on date,
  add column finished_at timestamptz,
  add constraint habits_ends_after_start_check check (ends_on is null or starts_on is null or ends_on >= starts_on),
  add constraint habits_finished_is_archived_check check (finished_at is null or archived_at is not null);

-- Same as 20260930100100_group_habits.sql, plus the first check.
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
  return 'missed';
end;
$$;


-- No check-ins after the end. Check-ins are only inserted by check_in_impl, which sets local_date
-- first, so this sees the real day.
create function private.check_in_not_after_end()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_ends date;
begin
  select h.ends_on into v_ends from public.habits h where h.id = new.habit_id;
  if v_ends is not null and new.local_date > v_ends then
    raise exception 'keepup:habit_ended' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger check_ins_not_after_end before insert on public.check_ins
  for each row execute function private.check_in_not_after_end();

-- Who may change a habit's end: the owner of a private habit, an admin of a group habit, or an adult
-- who manages the child for a child's habit. Anyone else: not found.
create function private.require_habit_manager(p_actor uuid, p_habit public.habits)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_habit.group_id is not null then
    perform private.require_admin(p_habit.group_id, p_actor);
  elsif p_habit.owner_id = p_actor then
    return;
  elsif exists (select 1 from public.profiles c where c.id = p_habit.owner_id and c.kind = 'child') then
    perform private.require_guardian(p_actor, p_habit.owner_id);
  else
    raise exception 'keepup:habit_not_found' using errcode = 'P0002';
  end if;
end;
$$;

create function private.habit_for_update(p_habit_id uuid)
returns public.habits
language plpgsql
set search_path = ''
as $$
declare
  v_habit public.habits;
begin
  select h.* into v_habit from public.habits h where h.id = p_habit_id for update;
  if not found then
    raise exception 'keepup:habit_not_found' using errcode = 'P0002';
  end if;
  return v_habit;
end;
$$;

-- Set, extend or remove the end (null). Never earlier than today or than the current end.
create function private.set_habit_end_impl(p_actor uuid, p_habit_id uuid, p_ends_on date, p_now timestamptz)
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
  if p_ends_on is not null and (p_ends_on < private.habit_today(v_habit, p_now) or p_ends_on < v_habit.ends_on) then
    raise exception 'keepup:end_too_early' using errcode = 'P0001';
  end if;
  update public.habits set ends_on = p_ends_on where id = p_habit_id returning * into v_habit;
  return v_habit;
end;
$$;

create function private.require_ended(p_habit public.habits, p_now timestamptz)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_habit.ends_on is null or private.habit_today(p_habit, p_now) <= p_habit.ends_on or p_habit.archived_at is not null then
    raise exception 'keepup:habit_not_ended' using errcode = 'P0001';
  end if;
end;
$$;

-- Keep going: the end is removed and the habit carries on. The days between the end and today had
-- nothing due, so they're settled as skipped first (they must not turn into "missed" later).
create function private.keep_going_impl(p_actor uuid, p_habit_id uuid, p_now timestamptz)
returns public.habits
language plpgsql
set search_path = ''
as $$
declare
  v_habit public.habits := private.habit_for_update(p_habit_id);
  v_step interval;
  v_from date;
  v_current date;
begin
  perform private.require_habit_manager(p_actor, v_habit);
  perform private.require_ended(v_habit, p_now);
  v_step := private.period_step(v_habit.period);
  v_from := (private.habit_period_start(v_habit, v_habit.ends_on)::timestamp + v_step)::date;
  v_current := private.habit_period_start(v_habit, private.habit_today(v_habit, p_now));
  insert into public.period_results (habit_id, period_start, outcome, finalized_at)
  select v_habit.id, s.d::date, 'skipped', p_now
    from generate_series(v_from::timestamp, v_current::timestamp - v_step, v_step) as s(d)
  on conflict (habit_id, period_start) do nothing;
  update public.habits set ends_on = null where id = p_habit_id returning * into v_habit;
  return v_habit;
end;
$$;

-- Finish: archived (history kept) and marked finished, for the Finished list.
create function private.finish_habit_impl(p_actor uuid, p_habit_id uuid, p_now timestamptz)
returns public.habits
language plpgsql
set search_path = ''
as $$
declare
  v_habit public.habits := private.habit_for_update(p_habit_id);
begin
  perform private.require_habit_manager(p_actor, v_habit);
  perform private.require_ended(v_habit, p_now);
  update public.habits set archived_at = p_now, finished_at = p_now where id = p_habit_id returning * into v_habit;
  return v_habit;
end;
$$;

-- The finish card: done periods out of those that counted (paused and the partial first period don't
-- count against you), and the best streak. For anyone who can see the habit.
create function private.habit_finish_summary_impl(p_actor uuid, p_habit_id uuid, p_now timestamptz)
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
  if not found or v_habit.ends_on is null
     or not (v_habit.owner_id = p_actor
             or (v_habit.group_id is not null and private.is_member(v_habit.group_id, p_actor))
             or exists (select 1 from public.profiles c
                         where c.id = v_habit.owner_id and c.kind = 'child' and private.is_member(c.group_id, p_actor))) then
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

create function public.set_habit_end(p_habit_id uuid, p_ends_on date)
returns public.habits language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return private.set_habit_end_impl(auth.uid(), p_habit_id, p_ends_on, now());
end;
$$;

create function public.keep_going(p_habit_id uuid)
returns public.habits language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return private.keep_going_impl(auth.uid(), p_habit_id, now());
end;
$$;

create function public.finish_habit(p_habit_id uuid)
returns public.habits language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return private.finish_habit_impl(auth.uid(), p_habit_id, now());
end;
$$;

create function public.habit_finish_summary(p_habit_id uuid)
returns table (done int, total int, best_streak int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return query select * from private.habit_finish_summary_impl(auth.uid(), p_habit_id, now());
end;
$$;

revoke execute on function
  public.set_habit_end(uuid, date), public.keep_going(uuid), public.finish_habit(uuid), public.habit_finish_summary(uuid)
  from public, anon;
grant execute on function
  public.set_habit_end(uuid, date), public.keep_going(uuid), public.finish_habit(uuid), public.habit_finish_summary(uuid)
  to authenticated;
