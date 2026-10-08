create table public.period_results (
  habit_id uuid not null references public.habits (id) on delete cascade,
  period_start date not null,
  outcome text not null check (outcome in ('done', 'missed', 'skipped')),
  finalized_at timestamptz not null default now(),
  primary key (habit_id, period_start)
);

alter table public.period_results enable row level security;
create policy "period_results: read own" on public.period_results
  for select to authenticated
  using (exists (select 1 from public.habits h where h.id = habit_id and h.owner_id = (select auth.uid())));
revoke all on public.period_results from anon, authenticated;
grant select on public.period_results to authenticated;

create function private.period_outcome(p_habit public.habits, p_period_start date)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_done int;
begin
  if private.is_frozen(p_habit.id, p_period_start, private.period_end(p_habit.period, p_period_start)) then
    return 'skipped';
  end if;
  select count(*) into v_done from public.check_ins c
   where c.habit_id = p_habit.id and c.period_start = p_period_start and c.status = 'approved';
  if v_done >= p_habit.target_count then
    return 'done';
  end if;
  -- The first period may be partial (a weekly habit starting on Saturday): never missed.
  if p_period_start = private.first_period_start(p_habit) then
    return 'skipped';
  end if;
  return 'missed';
end;
$$;

create function private.finalize_periods(p_now timestamptz)
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_habit public.habits;
  v_step interval;
  v_current date;
  v_inserted int;
  v_total int := 0;
begin
  for v_habit in select h.* from public.habits h where h.archived_at is null loop
    v_step := private.period_step(v_habit.period);
    v_current := private.habit_period_start(v_habit, private.habit_today(v_habit, p_now));

    insert into public.period_results (habit_id, period_start, outcome, finalized_at)
    select v_habit.id, s.d::date, private.period_outcome(v_habit, s.d::date), p_now
      from generate_series(private.first_period_start(v_habit)::timestamp, v_current::timestamp - v_step, v_step) as s(d)
     where not exists (
       select 1 from public.period_results x where x.habit_id = v_habit.id and x.period_start = s.d::date)
    on conflict (habit_id, period_start) do nothing;

    get diagnostics v_inserted = row_count;
    v_total := v_total + v_inserted;
  end loop;
  return v_total;
end;
$$;

-- Live streaks: finalized results where they exist, the same rules evaluated live where the job
-- hasn't run yet, plus the open period once it is done (it never breaks the streak).
create function private.habit_streaks(p_habit_id uuid, p_now timestamptz)
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
  v_current := private.habit_period_start(v_habit, private.habit_today(v_habit, p_now));

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

create function private.habit_summaries(p_user_id uuid, p_now timestamptz)
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
         (select max(f.ends_on) from public.habit_freezes f
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

create function private.habit_history(p_habit_id uuid, p_user_id uuid, p_now timestamptz, p_limit int)
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
  v_current := private.habit_period_start(v_habit, private.habit_today(v_habit, p_now));
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

create function public.habit_summaries()
returns table (
  habit_id uuid, title text, category public.habit_category, target_count smallint,
  period public.habit_period, starts_on date, created_at timestamptz, archived_at timestamptz,
  period_start date, not_started boolean, done_count int, checked_in_today boolean, frozen boolean,
  frozen_until date, days_left int, current_streak int, best_streak int)
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.habit_summaries(auth.uid(), now());
$$;

create function public.habit_history(p_habit_id uuid, p_limit int default 84)
returns table (period_start date, outcome text)
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.habit_history(p_habit_id, auth.uid(), now(), least(greatest(p_limit, 1), 400));
$$;

revoke execute on function public.habit_summaries() from public, anon;
revoke execute on function public.habit_history(uuid, int) from public, anon;
grant execute on function public.habit_summaries() to authenticated;
grant execute on function public.habit_history(uuid, int) to authenticated;

-- Finalize closed periods every 15 minutes (idempotent: re-scheduling by name updates the job).
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('keepup-finalize-periods', '*/15 * * * *', $$select private.finalize_periods(now())$$);
