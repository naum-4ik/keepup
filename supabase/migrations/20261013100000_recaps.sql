-- M5 recaps (ideas/achievements-and-rewards.md §6; owner 2026-10-04: Inbox rows and pushes, not Today
-- cards). Wins first: check-ins against targets, the longest streaks, badges earned; a miss is never
-- named. Computed on the fly, so the history outlives the 60-day feed. Times are the person's own
-- (their time zone and week start), as they are when the recap is computed.
--
-- Nothing is replaced. Already in place from earlier M5 migrations:
--   the weekly_recap, monthly_recap and family_recap kinds   20261009100000_xp_ledger.sql
--   their push categories (Achievements; family_recap → Group updates)
--                                                           private.push_category, 20261009100000
--   Achievements is Inbox only with no preference row       private.push_allowed, 20261010100000
--
-- A rested period (20261012100000_rest_days.sql) keeps the streak but isn't a check-in that was due:
-- it is left out of done and possible, as in week_overview, and counted on its own as `rested`.
--
-- Locks: enqueue_recaps only reads and inserts notifications (no XP, no level sync, so no
-- keepup.defer_levels); people are visited and each group's adults written in user id order.

create function private.recap_impl(p_user uuid, p_kind text, p_start date, p_now timestamptz)
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
     where (h.owner_id = p_user or h.group_id is not null) and private.takes_part(h, p_user)
       and h.starts_on < v_end
       and (p_kind = 'month' or h.period <> 'month')
  ), periods as (
    select hs.id, hs.period, hs.target_count, d::date as ps,
           (select x.outcome from public.period_results x where x.habit_id = hs.id and x.period_start = d::date) as settled
      from hs cross join generate_series(p_start::timestamp, (v_end - 1)::timestamp, interval '1 day') d
     where private.habit_period_start(hs.habit, d::date) = d::date
       and d::date >= hs.first_ps
       and (hs.ends_on is null or d::date <= hs.ends_on)
       and (hs.archived_at is null or hs.archived_at > private.local_midnight(d::date, private.habit_timezone(hs.habit)))
       and d::date <= private.local_date(p_now, v_tz)
       and not private.is_frozen(hs.id, d::date, private.period_end(hs.period, d::date))
       and not private.is_member_frozen(hs.id, p_user, d::date, private.period_end(hs.period, d::date))
       -- A group period counts only for the people it was due for (joined before it began).
       and (hs.group_id is null or p_user in (select r from private.required_members(hs.habit, d::date) r))
  ), counted as (
    select p.*, least(p.target_count, (select count(*) from public.check_ins c
                                        where c.habit_id = p.id and c.user_id = p_user and c.period_start = p.ps
                                          and c.status = 'approved'))::int as n
      from periods p
     where p.settled is distinct from 'rested'
  ), streaks as (
    select hs.title, hs.emoji, hs.period, st.current_streak as length
      from hs cross join lateral private.habit_streaks(hs.id, v_at) st
     where st.current_streak > 0
       and (hs.archived_at is null or hs.archived_at > v_at)
  ), top3 as (
    select s.* from streaks s order by s.length desc, s.title limit 3
  )
  select jsonb_build_object(
    'kind', p_kind, 'start', p_start, 'end', v_end,
    'done', coalesce((select sum(c.n) from counted c), 0),
    'possible', coalesce((select sum(c.target_count) from counted c), 0),
    'rested', (select count(*)::int from periods p where p.settled = 'rested'),
    'longest', (select jsonb_build_object('title', s.title, 'emoji', s.emoji, 'length', s.length, 'period', s.period)
                  from top3 s order by s.length desc, s.title limit 1),
    'top', coalesce((select jsonb_agg(jsonb_build_object('title', s.title, 'emoji', s.emoji, 'length', s.length, 'period', s.period)
                                      order by s.length desc, s.title) from top3 s), '[]'::jsonb),
    'badges', coalesce((select jsonb_agg(jsonb_build_object('code', a.code, 'name', a.name) order by ua.unlocked_at, a.sort_order)
                          from public.user_achievements ua join public.achievements a on a.code = ua.achievement_code
                         where ua.user_id = p_user
                           and ua.unlocked_at >= private.local_midnight(p_start, v_tz)
                           and ua.unlocked_at < private.local_midnight(v_end, v_tz)), '[]'::jsonb),
    -- A day per daily-habit day, for the heatmap; a day with only rested habits reads 0 of 0, rested.
    'days', coalesce((select jsonb_agg(jsonb_build_object('date', x.ps, 'done', x.done, 'possible', x.possible, 'rested', x.rested)
                                       order by x.ps)
                        from (select p.ps,
                                     coalesce(sum(c.n), 0)::int as done,
                                     coalesce(sum(c.target_count), 0)::int as possible,
                                     count(*) filter (where p.settled = 'rested')::int as rested
                                from periods p
                                left join counted c on c.id = p.id and c.ps = p.ps
                               where p.period = 'day' group by p.ps) x), '[]'::jsonb))
    into v_result;
  return v_result;
end;
$$;

-- The last completed weeks or months, newest first, back to the one the account started in (≤ 26).
create function private.recaps_impl(p_user uuid, p_kind text, p_count int, p_now timestamptz)
returns setof jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_tz text;
  v_week_start smallint;
  v_first date;
  v_current date;
  v_from date;
  v_to date;
begin
  if p_kind is null or p_kind not in ('week', 'month') then
    raise exception 'keepup:invalid_choice' using errcode = 'P0001';
  end if;
  select p.timezone, p.week_start, private.local_date(p.created_at, p.timezone)
    into v_tz, v_week_start, v_first
    from public.profiles p where p.id = p_user;
  if not found then
    return;
  end if;
  v_current := private.period_start(p_kind::public.habit_period, private.local_date(p_now, v_tz), v_week_start);
  for i in 1 .. least(greatest(coalesce(p_count, 8), 1), 26) loop
    v_from := case p_kind when 'week' then v_current - 7 * i else (v_current - make_interval(months => i))::date end;
    v_to := case p_kind when 'week' then v_from + 7 else (v_from + interval '1 month')::date end;
    exit when v_to <= v_first;
    return next private.recap_impl(p_user, p_kind, v_from, p_now);
  end loop;
end;
$$;

create function public.recaps(p_kind text, p_count int default 8)
returns setof jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return query select * from private.recaps_impl(auth.uid(), p_kind, p_count, now());
end;
$$;
revoke execute on function public.recaps(text, int) from public, anon;
grant execute on function public.recaps(text, int) to authenticated;

-- Every 15 minutes: in the hour from 10:00 local, the weekly recap on the first day of the person's week
-- and the monthly one on the 1st (adults, only when something was due), then the weekly family recap's
-- push on the first day of the group's week (the Inbox card from #123 stays its Inbox face). Each row
-- is written once (dedupe key per person and week or month), so the later ticks of the hour add nothing.
create function private.enqueue_recaps(p_now timestamptz)
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_user record;
  v_group record;
  v_best record;
  v_today date;
  v_at timestamptz;
  v_recap jsonb;
  v_month date;
  v_ws date;
  v_count int;
  v_n int := 0;
begin
  for v_user in select p.id, p.timezone, p.week_start from public.profiles p where p.kind = 'adult' order by p.id loop
    v_today := private.local_date(p_now, v_user.timezone);
    v_at := private.local_instant(v_today, time '10:00', v_user.timezone);
    continue when p_now < v_at or p_now >= v_at + interval '1 hour';
    if private.period_start('week', v_today, v_user.week_start) = v_today then
      v_recap := private.recap_impl(v_user.id, 'week', v_today - 7, p_now);
      if (v_recap ->> 'possible')::int > 0 then
        v_n := v_n + private.notify_count(array[v_user.id], 'weekly_recap', 'weekly_recap:' || (v_today - 7),
          null, null, null, null, null, v_recap);
      end if;
    end if;
    if extract(day from v_today) = 1 then
      v_month := (v_today - interval '1 month')::date;
      v_recap := private.recap_impl(v_user.id, 'month', v_month, p_now);
      if (v_recap ->> 'possible')::int > 0 then
        v_n := v_n + private.notify_count(array[v_user.id], 'monthly_recap', 'monthly_recap:' || v_month,
          null, null, null, null, null, v_recap);
      end if;
    end if;
  end loop;

  for v_group in select g.id, g.timezone, g.week_start from public.groups g order by g.id loop
    v_today := private.local_date(p_now, v_group.timezone);
    v_at := private.local_instant(v_today, time '10:00', v_group.timezone);
    continue when p_now < v_at or p_now >= v_at + interval '1 hour'
               or private.period_start('week', v_today, v_group.week_start) <> v_today;
    v_ws := v_today - 7;
    -- Same numbers as the Inbox card (private.family_recaps_impl).
    select count(*)::int into v_count from public.check_ins c join public.habits h on h.id = c.habit_id
     where h.group_id = v_group.id and c.status = 'approved' and c.local_date >= v_ws and c.local_date < v_today;
    continue when v_count = 0;
    select h.title, h.period, st.current_streak into v_best
      from public.habits h cross join lateral private.habit_streaks(h.id, p_now) st
     where h.group_id = v_group.id and h.archived_at is null and st.current_streak > 0
     order by st.current_streak desc, h.created_at limit 1;
    v_n := v_n + private.notify_count(
      array(select a from unnest(private.group_adults(v_group.id, null)) a order by a),
      'family_recap', 'family_recap:' || v_group.id || ':' || v_ws,
      v_group.id, null, null, null, null,
      jsonb_build_object('week_start', v_ws, 'check_ins', v_count,
        'best', case when v_best.title is null then null
                     else jsonb_build_object('title', v_best.title, 'length', v_best.current_streak, 'period', v_best.period) end));
  end loop;
  return v_n;
end;
$$;

select cron.schedule('keepup-recaps', '*/15 * * * *', $$select private.enqueue_recaps(now())$$);
