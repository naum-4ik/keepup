-- Progress → Calendar (ideas/progress-calendar.md): past days beyond this week. For each day in a range
-- and each of the caller's own habits: the outcome for daily habits (by the same rules as streaks and
-- week_overview: finalized period_results first, then private.period_outcome; the open current day
-- is "open" until done) and that day's approved-or-pending check-ins for every habit. Archived and
-- finished habits count for the days they were active. At most 62 days per call.
create function private.calendar_cells_impl(p_user uuid, p_from date, p_to date, p_now timestamptz)
returns table (local_date date, habit_id uuid, outcome text, check_ins int)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_today date;
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 61 then
    raise exception 'keepup:bad_range' using errcode = 'P0001';
  end if;
  select private.local_date(p_now, p.timezone) into v_today from public.profiles p where p.id = p_user;
  return query
    with hs as (
      select h as habit, h.id, h.period,
             private.first_period_start(h) as first_ps,
             coalesce(private.local_date(h.archived_at, private.habit_timezone(h)), v_today) as last_day
        from public.habits h
       where h.owner_id = p_user
    ),
    daily as (
      select g.d::date as day, hs.id,
             case
               when g.d::date = v_today then
                 case when private.period_outcome(hs.habit, g.d::date) = 'done' then 'done'
                      when private.is_frozen(hs.id, g.d::date, g.d::date + 1) then 'skipped' else 'open' end
               else coalesce(
                 (select x.outcome from public.period_results x where x.habit_id = hs.id and x.period_start = g.d::date),
                 private.period_outcome(hs.habit, g.d::date))
             end as outcome
        from hs
        cross join lateral generate_series(greatest(p_from, hs.first_ps)::timestamp, least(p_to, hs.last_day, v_today)::timestamp,
                                           interval '1 day') as g(d)
       where hs.period = 'day'
    ),
    counts as (
      select c.local_date as day, c.habit_id as id, count(*)::int as n
        from public.check_ins c join hs on hs.id = c.habit_id
       where c.user_id = p_user and c.status in ('approved', 'pending') and c.local_date between p_from and p_to
       group by 1, 2
    )
    select coalesce(d.day, c.day), coalesce(d.id, c.id), d.outcome, coalesce(c.n, 0)
      from daily d full join counts c on c.day = d.day and c.id = d.id
     order by 1, 2;
end;
$$;

create function public.calendar_cells(p_from date, p_to date)
returns table (local_date date, habit_id uuid, outcome text, check_ins int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return query select * from private.calendar_cells_impl(auth.uid(), p_from, p_to, now());
end;
$$;

revoke execute on function public.calendar_cells(date, date) from public, anon;
grant execute on function public.calendar_cells(date, date) to authenticated;
