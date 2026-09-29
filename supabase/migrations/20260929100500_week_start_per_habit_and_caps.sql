-- C1: snapshot each habit's week start at creation. Recomputing it live from the profile made
-- switching Mon/Sun rewrite the meaning of already-stored check_ins.period_start keys and wiped
-- streaks / phantom-missed already-finalized weeks. Not insertable/updatable by clients: no
-- column grant is added for `authenticated`.
alter table public.habits
  add column week_start smallint not null default 1 check (week_start in (0, 1));

update public.habits h set week_start = p.week_start
  from public.profiles p where p.id = h.owner_id;

create or replace function private.habit_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date;
begin
  select private.local_date(now(), p.timezone) into v_today
    from public.profiles p where p.id = new.owner_id;

  if tg_op = 'INSERT' then
    new.starts_on := coalesce(new.starts_on, v_today);
    new.week_start := (select p.week_start from public.profiles p where p.id = new.owner_id);
  end if;

  if tg_op = 'INSERT' or new.starts_on is distinct from old.starts_on then
    if tg_op = 'UPDATE' and exists (select 1 from public.check_ins c where c.habit_id = new.id) then
      raise exception 'keepup:start_locked' using errcode = 'P0001';
    end if;
    if new.starts_on < v_today then
      raise exception 'keepup:start_in_past' using errcode = 'P0001';
    end if;
    if new.starts_on > v_today + 365 then
      raise exception 'keepup:start_too_far' using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.archived_at is distinct from old.archived_at then
    new.archived_at := coalesce(old.archived_at, now());
  end if;
  return new;
end;
$$;

create or replace function private.habit_period_start(p_habit public.habits, p_local_date date)
returns date
language sql
stable
set search_path = ''
as $$
  select private.period_start(p_habit.period, p_local_date, p_habit.week_start);
$$;

-- I2: cap the series a habit is evaluated over at its archive date, so an archived habit's
-- streak/best/history freeze instead of drifting toward "missed" as real time moves on.
create function private.habit_last_date(p_habit public.habits, p_now timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select case
    when p_habit.archived_at is null then private.habit_today(p_habit, p_now)
    else least(private.habit_today(p_habit, p_now), private.habit_today(p_habit, p_habit.archived_at))
    end;
$$;

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
      v_outcome := private.period_outcome(v_habit, r.ps);
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

create or replace function private.habit_history(p_habit_id uuid, p_user_id uuid, p_now timestamptz, p_limit int)
returns table (period_start date, outcome text)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_habit public.habits;
  v_step interval;
  v_current date;
  v_from date;
begin
  select h.* into v_habit from public.habits h where h.id = p_habit_id and h.owner_id = p_user_id;
  if not found then
    return;
  end if;
  v_step := private.period_step(v_habit.period);
  v_current := private.habit_period_start(v_habit, private.habit_last_date(v_habit, p_now));
  v_from := greatest(private.first_period_start(v_habit),
                     (v_current::timestamp - v_step * (greatest(p_limit, 1) - 1))::date);

  return query
    select s.d::date,
           case
             when s.d::date = v_current then
               case
                 when private.period_outcome(v_habit, v_current) = 'done' then 'done'
                 when private.is_frozen(v_habit.id, v_current, private.period_end(v_habit.period, v_current)) then 'skipped'
                 else 'open'
               end
             else coalesce(
               (select x.outcome from public.period_results x
                 where x.habit_id = v_habit.id and x.period_start = s.d::date),
               private.period_outcome(v_habit, s.d::date))
           end
      from generate_series(v_from::timestamp, v_current::timestamp, v_step) as s(d)
     order by 1;
end;
$$;

-- I1: a time-zone change cannot reopen a period that's already been finalized.
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

  if private.is_frozen(p_habit_id, v_start, private.period_end(v_habit.period, v_start)) then
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

-- M1: an open-ended pause has no end date; reporting max(ends_on) silently ignored the open-ended
-- one whenever it wasn't the latest row. Report null instead.
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
         private.is_frozen(h.id, cur.start, cur.finish),
         (select case when bool_or(f.ends_on is null) then null else max(f.ends_on) end
            from public.habit_freezes f
           where f.habit_id = h.id and f.starts_on < cur.finish
             and coalesce(f.ends_on, 'infinity'::date) >= cur.start),
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
