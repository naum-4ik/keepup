-- Reset my data (owner 2026-10-06, CONTEXT "Decisions from chat"): Settings → "Reset my data", typed
-- "reset" to confirm. A fresh start for the person, without losing the account or the family.
--
-- Cleared (the caller's own):
--   - private habits (owner_id = me, no group) with their check-ins, period_results, pauses, per-habit
--     settings and their Inbox rows and nudges (all by the habits' cascades);
--   - the XP ledger, level-ups (so the level badge and the level moment start again), badges;
--   - the Inbox (every notification row of mine, recaps and history included) and dismissed cards.
-- Kept:
--   - the account, profile fields, settings (time zone, week start, celebrations), notification
--     prefs, push devices;
--   - groups, memberships, children (and all their data: they have Reset child), group habits;
--   - my check-ins, pauses and per-habit settings in group habits: they are the group's history
--     (controller ruling), so the group's results and streaks don't change. My XP from them is cleared
--     with the rest of the ledger; new check-ins earn again from zero;
--   - cheers I gave and nudges I sent or got on group habits (the other person's history);
--   - recap_runs: they only mark a recap as already sent (no content, purged after 62 days). Deleting
--     them would make the next cron tick send this week's recap again.
-- Idempotent: a second call finds nothing left to clear (it moves profiles.data_reset_at on).
--
-- Badges start fresh (owner 2026-10-07). profiles.data_reset_at is set to the reset's moment, and
-- every badge rule that reads history kept by the reset counts only what came after it
-- (private.after_reset):
--   - first_step, mover, home_keeper: check-ins created after it; full_day: a day that began after it;
--   - fair_judge: approvals reviewed after it; cheerleader: cheers given after it;
--   - all_together, team_player, the category counts, steady_month: periods (group ones, the only kind
--     the reset keeps) that began after it, in the habit's own zone; perfect_week: a week that began
--     after it;
--   - the group streak badges (First week … Year-round, Free, Hydrated) and Back on track: the
--     person's own run counts only periods that began after it (private.own_run_since,
--     private.own_comeback). The streak's earlier part doesn't count; a run that crosses the reset
--     starts at the first period after it.
--   XP-based counts (team_player, calm_mind, bookworm, good_company, go_getter) read the ledger, which
--   the reset empties; they also skip a period that began before the reset.
--
-- Locks: habit → check-in → period_results → per-habit rows → per-person rows. The private habits are
-- locked first, in id order (FOR UPDATE, as finalize_periods does), so a finalize or a check-in on one
-- of them either finishes before the reset or waits and then finds the habit gone. Their check-ins,
-- results and per-habit rows go with the habits (cascades; the check-in delete triggers see the habit
-- gone and grant nothing). Then this person's rows: ledger, levels, badges, Inbox, dismissed cards.
-- No other person's rows are written.

alter table public.profiles add column data_reset_at timestamptz;

create function private.reset_my_data_impl(p_user uuid, p_now timestamptz)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = p_user and p.kind = 'adult') then
    raise exception 'keepup:not_found' using errcode = 'P0002';
  end if;
  perform 1 from public.habits h where h.owner_id = p_user and h.group_id is null order by h.id for update;
  delete from public.habits h where h.owner_id = p_user and h.group_id is null;
  -- The ledger starts again from zero. Accepted (rare): an old group period upgraded late after the
  -- reset (a late check-in or approval within the window) pays its period XP again, since its earlier
  -- row is gone; it earns no badge (private.after_reset).
  delete from public.xp_events x where x.user_id = p_user;
  delete from public.level_ups l where l.user_id = p_user;
  delete from public.user_achievements a where a.user_id = p_user;
  delete from public.notifications n where n.user_id = p_user;
  delete from public.dismissed_cards d where d.user_id = p_user;
  update public.profiles p set data_reset_at = p_now where p.id = p_user;
end;
$$;

create function public.reset_my_data()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  perform private.reset_my_data_impl(auth.uid(), now());
end;
$$;

revoke execute on function public.reset_my_data() from public, anon;
grant execute on function public.reset_my_data() to authenticated;

-- Whether something at p_at counts toward p_user's badges: after their last Reset my data, if any.
create function private.after_reset(p_user uuid, p_at timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_at >= coalesce((select p.data_reset_at from public.profiles p where p.id = p_user), '-infinity'::timestamptz)
$$;

-- private.check_in_streak's group rule (20261014100000_streak_check_in_xp.sql), for badges: the
-- person's own run before p_period_start, counting only periods that began after their reset.
-- check_in_streak itself (the check-in XP bonus) is unchanged.
create function private.own_run_since(p_habit public.habits, p_user uuid, p_period_start date, p_at timestamptz, p_cap int)
returns int
language plpgsql
stable
set search_path = ''
as $$
declare
  v_step interval := private.period_step(p_habit.period);
  v_first date := private.first_period_start(p_habit);
  v_tz text := private.habit_timezone(p_habit);
  v_ps date := (p_period_start::timestamp - v_step)::date;
  v_run int := 0;
  v_out text;
begin
  while v_ps >= v_first and v_run < p_cap loop
    exit when not private.after_reset(p_user, private.local_midnight(v_ps, v_tz));
    v_out := private.own_outcome(p_habit, p_user, v_ps, p_at);
    exit when v_out = 'missed';
    if v_out = 'done' then
      v_run := v_run + 1;
    end if;
    v_ps := (v_ps::timestamp - v_step)::date;
  end loop;
  return v_run;
end;
$$;

-- Copied from 20261015100000_m5_final_review.sql (its only definition). New: the walk stops at the
-- person's reset.
create or replace function private.own_comeback(p_habit public.habits, p_user uuid, p_period_start date, p_at timestamptz)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_step interval := private.period_step(p_habit.period);
  v_first date := private.first_period_start(p_habit);
  v_tz text := private.habit_timezone(p_habit);
  v_ps date := p_period_start;
  v_missed boolean := false;
  v_out text;
begin
  while v_ps >= v_first loop
    exit when not private.after_reset(p_user, private.local_midnight(v_ps, v_tz));
    v_out := private.own_outcome(p_habit, p_user, v_ps, p_at);
    if v_out = 'missed' then
      v_missed := true;
    elsif v_out = 'done' and v_missed then
      return true;
    end if;
    v_ps := (v_ps::timestamp - v_step)::date;
  end loop;
  return false;
end;
$$;

-- Copied from 20261011100000_badges.sql (its only definition). New: First step, Mover, Home keeper
-- and Full day count only what came after the person's reset.
create or replace function private.badges_on_check_in(p_check_in public.check_ins, p_quiet boolean default false,
  p_sync boolean default true, p_late boolean default false)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_category public.habit_category;
  v_at timestamptz := p_check_in.created_at;
  v_reset timestamptz := coalesce((select p.data_reset_at from public.profiles p where p.id = p_check_in.user_id), '-infinity'::timestamptz);
begin
  if p_check_in.status <> 'approved' or v_at < v_reset then
    return;
  end if;
  perform private.award_badge(p_check_in.user_id, 'first_step', v_at, p_quiet, p_sync, p_late);
  select h.category into v_category from public.habits h where h.id = p_check_in.habit_id;
  if v_category in ('fitness', 'home') and (
       select count(*) from public.check_ins c join public.habits h on h.id = c.habit_id
        where c.user_id = p_check_in.user_id and c.status = 'approved' and h.category = v_category
          and c.created_at <= v_at and c.created_at >= v_reset) >= 50 then
    perform private.award_badge(p_check_in.user_id, case v_category when 'fitness' then 'mover' else 'home_keeper' end, v_at, p_quiet, p_sync, p_late);
  end if;
  if private.after_reset(p_check_in.user_id,
       private.local_midnight(p_check_in.local_date, (select p.timezone from public.profiles p where p.id = p_check_in.user_id)))
     and private.full_day(p_check_in.user_id, p_check_in.local_date) then
    perform private.award_badge(p_check_in.user_id, 'full_day', v_at, p_quiet, p_sync, p_late);
  end if;
end;
$$;

-- Copied from 20261011100000_badges.sql (its only definition). New: approvals made after the
-- reviewer's reset only.
create or replace function private.badges_on_review(p_check_in public.check_ins, p_quiet boolean default false, p_sync boolean default true)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_reset timestamptz;
begin
  if p_check_in.status <> 'approved' or p_check_in.reviewed_by is null then
    return;
  end if;
  v_reset := coalesce((select p.data_reset_at from public.profiles p where p.id = p_check_in.reviewed_by), '-infinity'::timestamptz);
  if (select count(*) from public.check_ins c
       where c.reviewed_by = p_check_in.reviewed_by and c.status = 'approved'
         and c.reviewed_at <= coalesce(p_check_in.reviewed_at, now()) and c.reviewed_at >= v_reset) >= 20 then
    perform private.award_badge(p_check_in.reviewed_by, 'fair_judge', coalesce(p_check_in.reviewed_at, now()), p_quiet, p_sync);
  end if;
end;
$$;

-- Copied from 20261011100000_badges.sql (its only definition). New: cheers given after the reset only.
create or replace function private.badges_on_cheer(p_user uuid, p_at timestamptz, p_quiet boolean default false)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.cheers c
       where c.user_id = p_user and c.created_at <= p_at
         and c.created_at >= coalesce((select p.data_reset_at from public.profiles p where p.id = p_user), '-infinity'::timestamptz)) >= 20 then
    perform private.award_badge(p_user, 'cheerleader', p_at, p_quiet);
  end if;
end;
$$;

-- Copied from 20261016100000_deferred_queue_table.sql (its latest definition). New: Perfect week, the
-- group streak badges, Back on track, the payees' badges (All together, Team player, the category
-- counts, Steady month) and the rested Full day re-judge count only periods that began after the
-- person's reset (header).
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
  v_own int;
  v_cap int;
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
                 or not private.after_reset(u, private.local_midnight(v_week, private.habit_timezone(p_habit)))
                 or exists (select 1 from public.user_achievements a where a.user_id = u and a.achievement_code = 'perfect_week');
      if p_sync or p_quiet then
        if private.perfect_week(u, v_week, p_at) then
          perform private.award_badge(u, 'perfect_week', p_at, p_quiet, p_sync, p_late);
        end if;
      else
        -- Judged once per person and week by sync_deferred_levels, after everything this transaction
        -- settles. The first entry for a (person, week) stays.
        perform private.queue_add('week', u, v_week::text, coalesce(p_at, now()), p_late, false);
      end if;
    end loop;
  end if;
  -- A group habit's streak badges read each member's own streak (owner 2026-10-06: your own part, as
  -- for Perfect week, XP, This week and the calendar), judged at any settle of a period whose own part
  -- they did (another member's miss doesn't settle it done). Walked back only as far as the largest
  -- threshold still to earn.
  if p_habit.group_id is not null then
    for u in select m.profile_id from private.required_members(p_habit, p_period_start) m(profile_id) order by 1 loop
      continue when (select count(*) from public.check_ins c
                      where c.habit_id = p_habit.id and c.user_id = u and c.period_start = p_period_start
                        and c.status = 'approved') < p_habit.target_count;
      select max(t.n) into v_cap
        from (values ('first_week', 7, true), ('back_on_track', 7, true),
                     ('two_weeks_strong', 14, p_habit.period = 'day'), ('unstoppable', 30, p_habit.period = 'day'),
                     ('century', 100, p_habit.period = 'day'), ('year_round', 365, p_habit.period = 'day'),
                     ('free', 30, p_habit.period = 'day' and p_habit.category = 'break_habit'),
                     ('hydrated', 7, p_habit.period = 'day' and p_habit.category = 'health' and p_habit.target_count >= 8)) t(code, n, applies)
       where t.applies
         and not exists (select 1 from public.user_achievements a where a.user_id = u and a.achievement_code = t.code);
      continue when v_cap is null;
      -- Only periods that started after the person's reset count (private.own_run_since).
      continue when not private.after_reset(u, private.local_midnight(p_period_start, private.habit_timezone(p_habit)));
      v_own := private.own_run_since(p_habit, u, p_period_start, p_at, v_cap - 1) + 1;
      continue when v_own < 7;
      perform private.award_badge(u, 'first_week', p_at, p_quiet, p_sync, p_late);
      if p_habit.period = 'day' then
        if v_own >= 14 then perform private.award_badge(u, 'two_weeks_strong', p_at, p_quiet, p_sync, p_late); end if;
        if v_own >= 30 then perform private.award_badge(u, 'unstoppable', p_at, p_quiet, p_sync, p_late); end if;
        if v_own >= 100 then perform private.award_badge(u, 'century', p_at, p_quiet, p_sync, p_late); end if;
        if v_own >= 365 then perform private.award_badge(u, 'year_round', p_at, p_quiet, p_sync, p_late); end if;
        if v_own >= 30 and p_habit.category = 'break_habit' then perform private.award_badge(u, 'free', p_at, p_quiet, p_sync, p_late); end if;
        if p_habit.category = 'health' and p_habit.target_count >= 8 then
          perform private.award_badge(u, 'hydrated', p_at, p_quiet, p_sync, p_late);
        end if;
      end if;
      if not exists (select 1 from public.user_achievements a where a.user_id = u and a.achievement_code = 'back_on_track')
         and private.own_comeback(p_habit, u, p_period_start, p_at) then
        perform private.award_badge(u, 'back_on_track', p_at, p_quiet, p_sync, p_late);
      end if;
    end loop;
  end if;
  if p_outcome = 'rested' then
    perform private.award_badge(p_habit.owner_id, 'rest_well', p_at, p_quiet, p_sync, p_late);
    -- Full day was judged at the day's check-ins, before this rest day existed: judge the day again
    -- now that the rested habit is left out (queued from the trigger, like every other award).
    if p_habit.period = 'day' and private.after_reset(p_habit.owner_id, private.local_midnight(p_period_start, private.habit_timezone(p_habit)))
       and private.full_day(p_habit.owner_id, p_period_start) then
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
    -- A period that started before this person's Reset my data (an old group period upgraded late)
    -- earns nothing: badges start fresh after a reset.
    continue when not private.after_reset(u, private.local_midnight(p_period_start, private.habit_timezone(p_habit)));
    -- Streak badges: private habits here (the group's are judged per member, above).
    if p_habit.group_id is null and v_run >= 7 then
      perform private.award_badge(u, 'first_week', p_at, p_quiet, p_sync, p_late);
    end if;
    if p_habit.group_id is null and p_habit.period = 'day' then
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
    if p_habit.group_id is null and v_run >= 7 and exists (
         select 1 from public.period_results m
          where m.habit_id = p_habit.id and m.outcome = 'missed' and m.period_start < v_start
            and exists (select 1 from public.period_results d where d.habit_id = p_habit.id and d.outcome = 'done' and d.period_start < m.period_start)) then
      perform private.award_badge(u, 'back_on_track', p_at, p_quiet, p_sync, p_late);
    end if;
    if (p_habit.period = 'week'
        and (select count(*) from public.period_results x where x.habit_id = p_habit.id and x.outcome = 'done'
              and x.period_start >= v_month and x.period_start < v_next
              and private.after_reset(u, private.local_midnight(x.period_start, private.habit_timezone(p_habit)))) >= 4
        and not exists (select 1 from public.period_results x where x.habit_id = p_habit.id and x.outcome = 'missed'
              and x.period_start >= v_month and x.period_start < v_next
              and private.after_reset(u, private.local_midnight(x.period_start, private.habit_timezone(p_habit)))))
       or (p_habit.period = 'month' and v_run >= 3
           and private.after_reset(u, private.local_midnight((p_period_start - interval '2 months')::date, private.habit_timezone(p_habit)))) then
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
