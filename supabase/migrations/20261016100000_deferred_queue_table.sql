-- Finalize scaling (M5 final review M1). The transaction-local GUC strings that queued deferred work
-- (keepup.unsynced, keepup.unbadged, keepup.unjudged, keepup.late_users) were appended to and searched
-- on every grant, badge and settle (string concatenation, regexp_match, strpos, string_to_array), so a
-- finalize that settles N periods did O(N) work per step: 3,000 habits took 12.9 s and 6,000 took
-- 68 s locally (the reviewer measured 7.4 s / 23 s). They become rows of one session temp table,
-- pg_temp.keepup_deferred, with a primary key (kind, user_id, key), so adding and deduping is an index
-- lookup.
--
-- Same semantics as the strings:
--   - transaction-local: ON COMMIT DELETE ROWS, and rows written in a transaction or subtransaction
--     that rolls back go with it (a failed review inside "Approve all" drops its queued entries, as
--     the GUC changes did);
--   - level: one row per person to sync (was keepup.unsynced);
--   - badge: one row per (person, badge); a later call with an earlier moment replaces it with its own
--     late flag, so the earliest moment wins (was keepup.unbadged + distinct on … order by at);
--   - week: the first (person, week) queued for Perfect week stays (was keepup.unjudged);
--   - late: the people whose level_up is marked late (was keepup.late_users), cleared at the end of
--     sync_deferred_levels;
--   - sync_deferred_levels still judges the weeks first, then writes, per person in user id order,
--     the level and then that person's badges by code.
-- keepup.defer_levels stays a GUC: it is a single flag, not a queue.
--
-- The table is created on first use in each session (private.queue_table) by SECURITY DEFINER
-- helpers, so it is always owned by and read as the function owner, whatever role the request runs
-- as. API roles can't run SQL, so nobody can create their own pg_temp.keepup_deferred first.
--
-- Replaced functions are copied from their latest definitions; only the queue lines change:
--   private.grant_xp                20261009100000_xp_ledger.sql
--   private.award_badge             20261011100000_badges.sql
--   private.backfill_milestones     20261010100000_streak_milestones.sql
--   private.badges_on_period        20261015100000_m5_final_review.sql
--   private.mark_late_levels        20261015100000_m5_final_review.sql
--   private.sync_level              20261015100000_m5_final_review.sql
--   private.sync_deferred_levels    20261015100000_m5_final_review.sql
--
-- Locks: unchanged (habit → check-in → period_results → per-habit rows → per-person rows, in user id
-- order). The queue is session-private: no other transaction can see or lock its rows.

-- badges_on_period's category and Team player counts read one person's period_done rows up to a
-- moment. With only xp_events_user_idx (user_id, created_at) and xp_events_habit_idx (habit_id,
-- reason), a plan made while the ledger looked small walked every period_done row (the habit index,
-- reason only) for each settle: the rest of finalize's quadratic cost. This index answers it directly.
create index xp_events_user_reason_idx on public.xp_events (user_id, reason, created_at);

create type private.queue_entry as (kind text, user_id uuid, key text, at timestamptz, late boolean);

create function private.queue_table()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if to_regclass('pg_temp.keepup_deferred') is null then
    create temp table keepup_deferred (
      kind text not null check (kind in ('level', 'badge', 'week', 'late')),
      user_id uuid not null,
      key text not null,
      at timestamptz,
      late boolean not null default false,
      primary key (kind, user_id, key)
    ) on commit delete rows;
  end if;
end;
$$;

-- Adds an entry; false when nothing changed. p_earliest: an entry already queued keeps its place
-- unless this one is earlier (then this one, with its late flag, replaces it). Otherwise the first
-- entry stays.
create function private.queue_add(p_kind text, p_user uuid, p_key text, p_at timestamptz, p_late boolean, p_earliest boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.queue_table();
  if p_earliest then
    insert into pg_temp.keepup_deferred as d (kind, user_id, key, at, late)
    values (p_kind, p_user, p_key, p_at, coalesce(p_late, false))
    on conflict (kind, user_id, key) do update set at = excluded.at, late = excluded.late
      where d.at > excluded.at;
  else
    insert into pg_temp.keepup_deferred (kind, user_id, key, at, late)
    values (p_kind, p_user, p_key, p_at, coalesce(p_late, false))
    on conflict (kind, user_id, key) do nothing;
  end if;
  return found;
end;
$$;

create function private.queue_has(p_kind text, p_user uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if to_regclass('pg_temp.keepup_deferred') is null then
    return false;
  end if;
  return exists (select 1 from pg_temp.keepup_deferred d where d.kind = p_kind and d.user_id = p_user);
end;
$$;

create function private.queue_list(p_kind text)
returns setof private.queue_entry
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.queue_table();
  return query select d.kind, d.user_id, d.key, d.at, d.late from pg_temp.keepup_deferred d where d.kind = p_kind;
end;
$$;

-- Removes and returns the entries of these kinds.
create function private.queue_take(p_kinds text[])
returns setof private.queue_entry
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.queue_table();
  return query
    with d as (delete from pg_temp.keepup_deferred q where q.kind = any (p_kinds)
               returning q.kind, q.user_id, q.key, q.at, q.late)
    select d.kind, d.user_id, d.key, d.at, d.late from d;
end;
$$;

-- Drops the level entries of everyone not in p_keep (backfill_milestones: its own grants are synced
-- quietly by its own level pass; a caller's pending ones stay).
create function private.queue_keep_levels(p_keep uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.queue_table();
  delete from pg_temp.keepup_deferred d where d.kind = 'level' and d.user_id <> all (coalesce(p_keep, '{}'));
end;
$$;

revoke all on function private.queue_table(), private.queue_add(text, uuid, text, timestamptz, boolean, boolean),
  private.queue_has(text, uuid), private.queue_list(text), private.queue_take(text[]), private.queue_keep_levels(uuid[])
  from public, anon, authenticated;

-- Copied from 20261009100000_xp_ledger.sql (its only definition). New: the deferred sync is a queue row.
create or replace function private.grant_xp(
  p_user uuid, p_amount int, p_reason text, p_source_type text, p_source_id text,
  p_habit_id uuid default null, p_at timestamptz default now(), p_quiet boolean default false,
  p_sync boolean default true)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = p_user) then
    return false;
  end if;
  insert into public.xp_events (user_id, amount, reason, source_type, source_id, habit_id, created_at)
  values (p_user, p_amount, p_reason, p_source_type, p_source_id, p_habit_id, coalesce(p_at, now()))
  on conflict on constraint xp_events_grant_once do nothing;
  if not found then
    return false;
  end if;
  if p_sync then
    perform private.sync_level(p_user, p_quiet);
  else
    -- Synced later by private.sync_deferred_levels (finalize, after its habit loop). Not quiet.
    perform private.queue_add('level', p_user, '', null, false, false);
  end if;
  return true;
end;
$$;

-- Copied from 20261011100000_badges.sql (its only definition). New: the queue is a table row per
-- (person, badge) that keeps its earliest moment.
create or replace function private.award_badge(p_user uuid, p_code text, p_at timestamptz default now(), p_quiet boolean default false,
  p_sync boolean default true, p_late boolean default false)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  if p_user is null then
    return false;
  end if;
  if not p_sync and not p_quiet then
    -- Already earned: nothing to add. Already queued at the same moment or earlier: unchanged. A later
    -- call that is earlier replaces it (with its late flag), so the sync writes the earliest moment.
    if not exists (select 1 from public.user_achievements a where a.user_id = p_user and a.achievement_code = p_code) then
      perform private.queue_add('badge', p_user, p_code, coalesce(p_at, now()), p_late, true);
    end if;
    return false;
  end if;
  insert into public.user_achievements (user_id, achievement_code, unlocked_at, seen_at)
  select p_user, p_code, coalesce(p_at, now()), case when p_quiet then now() end
   where exists (select 1 from public.profiles p where p.id = p_user)
  on conflict (user_id, achievement_code) do nothing;
  if not found then
    return false;
  end if;
  if not p_quiet and (select p.kind from public.profiles p where p.id = p_user) = 'adult' then
    perform private.notify(array[p_user], 'badge_unlocked', 'badge_unlocked:' || p_code, null, null, null, null, null,
      jsonb_build_object('code', p_code, 'name', (select a.name from public.achievements a where a.code = p_code))
        || case when p_late then jsonb_build_object('late', true) else '{}'::jsonb end);
  end if;
  return true;
end;
$$;

-- Copied from 20261015100000_m5_final_review.sql (its only definition). New: a queue row per person.
create or replace function private.mark_late_levels(p_users uuid[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  u uuid;
begin
  for u in select distinct x from unnest(p_users) x where x is not null loop
    perform private.queue_add('late', u, '', null, false, false);
  end loop;
end;
$$;

-- Copied from 20261015100000_m5_final_review.sql (its latest definition). New: late is a queue row.
create or replace function private.sync_level(p_user uuid, p_quiet boolean)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_level int;
  v_top int;
begin
  select private.level_for(coalesce(sum(x.amount), 0)) into v_level from public.xp_events x where x.user_id = p_user;
  if v_level < 2 then
    return;
  end if;
  with ins as (
    insert into public.level_ups (user_id, level, seen_at)
    select p_user, l, case when p_quiet then now() end from generate_series(2, v_level) l
    on conflict (user_id, level) do nothing
    returning level)
  select max(level) into v_top from ins;
  if v_top is not null and not p_quiet
     and (select p.kind from public.profiles p where p.id = p_user) = 'adult' then
    perform private.notify(array[p_user], 'level_up', 'level_up:' || v_top, null, null, null, null, null,
      jsonb_build_object('level', v_top)
        || case when private.queue_has('late', p_user) then jsonb_build_object('late', true) else '{}'::jsonb end);
  end if;
end;
$$;

-- Copied from 20261015100000_m5_final_review.sql (its latest definition). New: reads the queue table.
-- The queued Perfect week judgements are made first, once per person and week, when everything the
-- transaction settled is visible (reads only); a true one joins the badges. Then one batch, per person
-- in user id order: the level, then that person's badges by code (Locks, at the top). The late marks
-- are cleared at the end.
create or replace function private.sync_deferred_levels()
returns void
language plpgsql
set search_path = ''
as $$
declare
  r record;
begin
  for r in select w.user_id as id, w.key::date as week, w.at, w.late from private.queue_take(array['week']) w order by 1, 2 loop
    if not exists (select 1 from public.user_achievements a where a.user_id = r.id and a.achievement_code = 'perfect_week')
       and private.perfect_week(r.id, r.week, r.at) then
      perform private.queue_add('badge', r.id, 'perfect_week', r.at, r.late, true);
    end if;
  end loop;
  for r in
    select x.user_id as id, x.kind, x.key as code, x.at, x.late
      from private.queue_take(array['level', 'badge']) x
     order by x.user_id, x.kind = 'badge', x.key
  loop
    if r.kind = 'level' then
      perform private.sync_level(r.id, false);
    else
      perform private.award_badge(r.id, r.code, r.at, false, true, r.late);
    end if;
  end loop;
  perform 1 from private.queue_take(array['late']);
end;
$$;

-- Copied from 20261010100000_streak_milestones.sql (its only definition). New: the caller's pending level
-- syncs are kept through the queue table.
create or replace function private.backfill_milestones()
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_pending uuid[] := array(select d.user_id from private.queue_list('level') d);
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
  perform private.queue_keep_levels(v_pending);

  insert into public.level_ups (user_id, level, seen_at)
  select t.user_id, l, now()
    from (select x.user_id, private.level_for(sum(x.amount)) as level from public.xp_events x group by x.user_id) t
   cross join lateral generate_series(2, t.level) l
  on conflict (user_id, level) do nothing;

  return v_n;
end;
$$;

-- Copied from 20261015100000_m5_final_review.sql (its latest definition). New: Perfect week judgements are
-- queued as table rows (the first per person and week stays).
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
      v_own := private.check_in_streak(p_habit, u, p_period_start, p_at, v_cap - 1) + 1;
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
    if p_habit.period = 'day' and private.full_day(p_habit.owner_id, p_period_start) then
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
              and x.period_start >= v_month and x.period_start < v_next) >= 4
        and not exists (select 1 from public.period_results x where x.habit_id = p_habit.id and x.outcome = 'missed'
              and x.period_start >= v_month and x.period_start < v_next))
       or (p_habit.period = 'month' and v_run >= 3) then
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
