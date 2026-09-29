-- A pause protects the streak; it never blocks an active day. Before this, a weekly/monthly habit
-- was "frozen" whenever any pause overlapped the period: resuming mid-week still blocked check-ins
-- until next week, a pause scheduled for Saturday blocked Wednesday, and pausing after finishing
-- 3/3 turned the week into `skipped`.
--  * Check-ins and the summary's frozen/frozen_until ask "is today a paused day?".
--  * The period outcome keeps whole-period overlap (a pause anywhere in the week excuses it), but
--    a period that was completed is `done` first.
--  * A pause may omit its start date, meaning "today" in the server's view of the owner's time
--    zone, so a client whose "today" went stale after local midnight isn't refused.

create or replace function private.period_outcome(p_habit public.habits, p_period_start date)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_done int;
begin
  select count(*) into v_done from public.check_ins c
   where c.habit_id = p_habit.id and c.period_start = p_period_start and c.status = 'approved';
  if v_done >= p_habit.target_count then
    return 'done';
  end if;
  if private.is_frozen(p_habit.id, p_period_start, private.period_end(p_habit.period, p_period_start)) then
    return 'skipped';
  end if;
  -- The first period may be partial (a weekly habit starting on Saturday): never missed.
  if p_period_start = private.first_period_start(p_habit) then
    return 'skipped';
  end if;
  return 'missed';
end;
$$;

create or replace function private.check_in_impl(p_habit_id uuid, p_user_id uuid, p_now timestamptz)
returns public.check_ins
language plpgsql
set search_path = ''
as $$
declare
  v_habit public.habits;
  v_today date;
  v_start date;
  v_count int;
  v_row public.check_ins;
begin
  -- The row lock serialises concurrent check-ins (a double tap on a phone) for this habit.
  select h.* into v_habit from public.habits h
   where h.id = p_habit_id and h.owner_id = p_user_id
     for update;
  if not found then
    raise exception 'keepup:habit_not_found' using errcode = 'P0002';
  end if;
  if v_habit.archived_at is not null then
    raise exception 'keepup:habit_archived' using errcode = 'P0001';
  end if;

  v_today := private.habit_today(v_habit, p_now);
  if v_today < v_habit.starts_on then
    raise exception 'keepup:habit_not_started' using errcode = 'P0001';
  end if;
  v_start := private.habit_period_start(v_habit, v_today);

  if exists (select 1 from public.period_results r where r.habit_id = p_habit_id and r.period_start = v_start) then
    raise exception 'keepup:period_closed' using errcode = 'P0001';
  end if;

  if private.is_frozen(p_habit_id, v_today, v_today + 1) then
    raise exception 'keepup:habit_frozen' using errcode = 'P0001';
  end if;

  select count(*) into v_count from public.check_ins c
   where c.habit_id = p_habit_id and c.user_id = p_user_id
     and c.period_start = v_start and c.status <> 'rejected';
  if v_count >= v_habit.target_count then
    raise exception 'keepup:target_reached' using errcode = 'P0001';
  end if;

  if v_habit.period <> 'day' and exists (
    select 1 from public.check_ins c
     where c.habit_id = p_habit_id and c.user_id = p_user_id
       and c.local_date = v_today and c.status <> 'rejected'
  ) then
    raise exception 'keepup:already_checked_in_today' using errcode = 'P0001';
  end if;

  insert into public.check_ins (habit_id, user_id, local_date, period_start, created_at)
  values (p_habit_id, p_user_id, v_today, v_start, p_now)
  returning * into v_row;
  return v_row;
end;
$$;

-- frozen: today is a paused day. frozen_until: the last day of the pause covering today (pauses
-- never overlap, so there is at most one), null when it is open-ended or there is none.
create or replace function private.habit_summaries(p_user_id uuid, p_now timestamptz)
returns table (
  habit_id uuid, title text, category public.habit_category, target_count smallint,
  period public.habit_period, starts_on date, created_at timestamptz, archived_at timestamptz,
  period_start date, not_started boolean, done_count int, checked_in_today boolean, frozen boolean,
  frozen_until date, days_left int, current_streak int, best_streak int)
language sql
stable
set search_path = ''
as $$
  select h.id, h.title, h.category, h.target_count, h.period, h.starts_on, h.created_at, h.archived_at,
         cur.start,
         ctx.today < h.starts_on,
         (select count(*)::int from public.check_ins c
           where c.habit_id = h.id and c.period_start = cur.start and c.status = 'approved'),
         exists (select 1 from public.check_ins c
                  where c.habit_id = h.id and c.local_date = ctx.today and c.status <> 'rejected'),
         private.is_frozen(h.id, ctx.today, ctx.today + 1),
         (select f.ends_on from public.habit_freezes f
           where f.habit_id = h.id and f.starts_on <= ctx.today
             and coalesce(f.ends_on, 'infinity'::date) >= ctx.today
           limit 1),
         (cur.finish - ctx.today),
         st.current_streak, st.best_streak
    from public.habits h
    cross join lateral (select private.habit_today(h, p_now) as today) ctx
    cross join lateral (select private.habit_period_start(h, ctx.today) as start) s0
    cross join lateral (select s0.start, private.period_end(h.period, s0.start) as finish) cur
    cross join lateral private.habit_streaks(h.id, p_now) st
   where h.owner_id = p_user_id
   order by h.archived_at nulls first, h.created_at;
$$;

-- p_starts_on null means today in the owner's time zone.
create or replace function private.freeze_habit_impl(
  p_habit_id uuid, p_user_id uuid, p_starts_on date, p_ends_on date, p_now timestamptz)
returns public.habit_freezes
language plpgsql
set search_path = ''
as $$
declare
  v_habit public.habits;
  v_start date;
  v_row public.habit_freezes;
begin
  select h.* into v_habit from public.habits h
   where h.id = p_habit_id and h.owner_id = p_user_id and h.archived_at is null
     for update;
  if not found then
    raise exception 'keepup:habit_not_found' using errcode = 'P0002';
  end if;

  v_start := coalesce(p_starts_on, private.habit_today(v_habit, p_now));
  if v_start < private.habit_today(v_habit, p_now) then
    raise exception 'keepup:freeze_in_past' using errcode = 'P0001';
  end if;
  if p_ends_on is not null and p_ends_on < v_start then
    raise exception 'keepup:freeze_range_invalid' using errcode = 'P0001';
  end if;
  if private.is_frozen(p_habit_id, v_start, coalesce(p_ends_on + 1, 'infinity'::date)) then
    raise exception 'keepup:freeze_overlaps' using errcode = 'P0001';
  end if;

  insert into public.habit_freezes (habit_id, starts_on, ends_on)
  values (p_habit_id, v_start, p_ends_on)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.freeze_habit(p_habit_id uuid, p_starts_on date default null, p_ends_on date default null)
returns public.habit_freezes
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'keepup:not_authenticated' using errcode = '42501';
  end if;
  return private.freeze_habit_impl(p_habit_id, auth.uid(), p_starts_on, p_ends_on, now());
end;
$$;

revoke execute on function public.freeze_habit(uuid, date, date) from public, anon;
grant execute on function public.freeze_habit(uuid, date, date) to authenticated;
