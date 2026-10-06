-- M5 badges (ideas/achievements-and-rewards.md §4; Go-getter replaces Saver, 2026-09-29) and the
-- Celebrations setting (§9). Replaced functions are copied from their latest definitions:
--   private.sync_deferred_levels       20261009100000_xp_ledger.sql
--   private.rewards_on_check_in        20261009100000_xp_ledger.sql
--   private.reset_child_impl           20261009100000_xp_ledger.sql
--   private.rewards_on_period_result   20261010100000_streak_milestones.sql
-- Counts read the ledger and check-ins up to the moment being judged (p_at), so the backfill dates each
-- badge when it was really earned. An undo never takes a badge back: once earned, it stays.
--
-- Locks: unchanged from 20261009100000_xp_ledger.sql (habit → check-in → period_results → per-habit
-- rows → per-person rows, in user id order). A badge is a per-person row (user_achievements
-- (user, code), and its badge_unlocked Inbox row). The hooks only read; the check-in and period
-- triggers judge at once but queue the awards (p_sync = false, keepup.unbadged), and
-- private.sync_deferred_levels writes them with the levels: per person in user id order, the level
-- first, then that person's badges. So inside finalize_periods / review_check_ins / check_in_with
-- (keepup.defer_levels) badges are written once, after the loop, and a single check-in, approval or
-- late upgrade writes them in the same one batch as its levels. The habit and cheer triggers award
-- one badge to one person at once (no other per-person row follows in those transactions).

create table public.achievements (
  code text primary key check (code ~ '^[a-z_]{1,40}$'),
  name text not null,
  description text not null,
  icon text not null,
  badge_group text not null check (badge_group in ('getting_started', 'consistency', 'categories', 'comeback', 'family')),
  sort_order int not null unique
);
alter table public.achievements enable row level security;
create policy "achievements: catalog" on public.achievements for select to authenticated using (true);
revoke all on public.achievements from anon, authenticated;
grant select on public.achievements to authenticated;

-- description is the one-line hint shown on a locked badge. icon is a lucide component name.
insert into public.achievements (code, name, description, icon, badge_group, sort_order) values
  ('planted', 'Planted', 'Create your first habit.', 'Sprout', 'getting_started', 1),
  ('first_step', 'First step', 'Check in for the first time.', 'CircleCheck', 'getting_started', 2),
  ('full_day', 'Full day', 'Finish every habit due today, at least two.', 'CalendarCheck', 'getting_started', 3),
  ('first_week', 'First week', 'Keep any habit going 7 times in a row.', 'Flame', 'getting_started', 4),
  ('two_weeks_strong', 'Two weeks strong', '14 days in a row.', 'CalendarRange', 'consistency', 5),
  ('unstoppable', 'Unstoppable', '30 days in a row.', 'Zap', 'consistency', 6),
  ('century', 'Century', '100 days in a row.', 'Mountain', 'consistency', 7),
  ('year_round', 'Year-round', '365 days in a row.', 'TreePine', 'consistency', 8),
  ('perfect_week', 'Perfect week', 'Every habit, every time, for a whole week. At least two habits.', 'Star', 'consistency', 9),
  ('steady_month', 'Steady month', 'Four weeks of a weekly habit in one month, or a monthly habit three months running.', 'CalendarDays', 'consistency', 10),
  ('hydrated', 'Hydrated', 'A Health habit of 8 or more a day, 7 days in a row.', 'Droplet', 'categories', 11),
  ('mover', 'Mover', '50 check-ins in Fitness.', 'Bike', 'categories', 12),
  ('calm_mind', 'Calm mind', '30 times done in Mind.', 'Leaf', 'categories', 13),
  ('bookworm', 'Bookworm', '30 times done in Learning.', 'BookOpen', 'categories', 14),
  ('good_company', 'Good company', '10 times done in People.', 'Heart', 'categories', 15),
  ('home_keeper', 'Home keeper', '50 check-ins in Home.', 'House', 'categories', 16),
  ('go_getter', 'Go-getter', '6 times done in Work & money.', 'BriefcaseBusiness', 'categories', 17),
  ('free', 'Free', '30 days in a row on a Break a habit habit.', 'Shield', 'categories', 18),
  ('back_on_track', 'Back on track', 'Build a 7 in a row again after a streak ended.', 'RotateCcw', 'comeback', 19),
  ('rest_well', 'Rest well', 'Use your first rest day.', 'Moon', 'comeback', 20),
  ('all_together', 'All together', 'Your group''s first "Everyone did it".', 'Users', 'family', 21),
  ('team_player', 'Team player', '10 group habits done together.', 'Handshake', 'family', 22),
  ('cheerleader', 'Cheerleader', 'Cheer 20 check-ins.', 'PartyPopper', 'family', 23),
  ('fair_judge', 'Fair judge', 'Approve 20 check-ins.', 'Scale', 'family', 24);

create table public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_code text not null references public.achievements (code),
  unlocked_at timestamptz not null default now(),
  seen_at timestamptz,
  primary key (user_id, achievement_code)
);
alter table public.user_achievements enable row level security;
create policy "user_achievements: read own" on public.user_achievements for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.user_achievements from anon, authenticated;
grant select on public.user_achievements to authenticated;

-- Settings → Celebrations (§9): Full (the ~2 s moment with confetti) or Subtle (a small toast).
alter table public.profiles add column celebrations text not null default 'full' check (celebrations in ('full', 'subtle'));

-- Once per person and badge. An adult gets one Inbox row (Achievements: Inbox only by default); a
-- child gets the badge only. Quiet (backfill): marked seen, no row. p_sync = false (the check-in and
-- period triggers): judged now, written by private.sync_deferred_levels with the levels (Locks, at
-- the top); returns false then. p_late: the event was a late check-in (payload late: true; delivery
-- follows Achievements, like streak_milestone).
create function private.award_badge(p_user uuid, p_code text, p_at timestamptz default now(), p_quiet boolean default false,
  p_sync boolean default true, p_late boolean default false)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_queue text;
begin
  if p_user is null then
    return false;
  end if;
  if not p_sync and not p_quiet then
    v_queue := coalesce(current_setting('keepup.unbadged', true), '');
    -- Already earned, or already queued in this transaction (the earliest moment wins): nothing to add.
    if exists (select 1 from public.user_achievements a where a.user_id = p_user and a.achievement_code = p_code)
       or strpos(';' || v_queue, ';' || p_user || '|' || p_code || '|') > 0 then
      return false;
    end if;
    perform set_config('keepup.unbadged',
      coalesce(nullif(v_queue, '') || ';', '') || p_user || '|' || p_code || '|' || coalesce(p_at, now()) || '|' || p_late, true);
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

-- Copied from 20261009100000_xp_ledger.sql (its latest definition). New: the queued badges
-- (keepup.unbadged) are written here too, and an empty level list no longer returns early. One batch,
-- per person in user id order: the level, then that person's badges (Locks, at the top).
create or replace function private.sync_deferred_levels()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_list text := nullif(current_setting('keepup.unsynced', true), '');
  v_badges text := nullif(current_setting('keepup.unbadged', true), '');
  r record;
begin
  perform set_config('keepup.unsynced', '', true);
  perform set_config('keepup.unbadged', '', true);
  if v_list is null and v_badges is null then
    return;
  end if;
  for r in
    select x.id, x.step, x.code, x.at, x.late
      from (select distinct u::uuid as id, 0 as step, null::text as code, null::timestamptz as at, false as late
              from unnest(string_to_array(v_list, ',')) u
            union all
            select split_part(b, '|', 1)::uuid, 1, split_part(b, '|', 2),
                   min(split_part(b, '|', 3)::timestamptz), bool_or(split_part(b, '|', 4)::boolean)
              from unnest(string_to_array(v_badges, ';')) b
             group by 1, 2, 3) x
     order by x.id, x.step, x.code
  loop
    if r.step = 0 then
      perform private.sync_level(r.id, false);
    else
      perform private.award_badge(r.id, r.code, r.at, false, true, r.late);
    end if;
  end loop;
end;
$$;

-- Full day: every daily habit due for the person on that local date is done, and there are at least two.
create function private.full_day(p_user uuid, p_date date)
returns boolean
language sql
stable
set search_path = ''
as $$
  with due as (
    select h.id, h.target_count
      from public.habits h
     where h.period = 'day' and h.archived_at is null
       and h.starts_on <= p_date and (h.ends_on is null or h.ends_on >= p_date)
       and (h.owner_id = p_user or h.group_id is not null)
       and private.takes_part(h, p_user)
       and not private.is_frozen(h.id, p_date, p_date + 1)
       and not private.is_member_frozen(h.id, p_user, p_date, p_date + 1))
  select count(*) >= 2 and coalesce(bool_and((
           select count(*) from public.check_ins c
            where c.habit_id = d.id and c.user_id = p_user and c.local_date = p_date and c.status = 'approved') >= d.target_count), false)
    from due d;
$$;

-- Perfect week: in the person's week starting p_week_start, every period of every daily and weekly habit
-- they took part in all week is settled done (or paused), with at least two habits done.
create function private.perfect_week(p_user uuid, p_week_start date)
returns boolean
language sql
stable
set search_path = ''
as $$
  with hs as (
    select h as habit, h.id, h.period
      from public.habits h
     where h.period in ('day', 'week')
       and (h.owner_id = p_user or h.group_id is not null) and private.takes_part(h, p_user)
       and h.starts_on <= p_week_start
       and (h.ends_on is null or h.ends_on >= p_week_start + 6)
       and (h.archived_at is null or h.archived_at >= private.local_midnight(p_week_start + 7, private.habit_timezone(h)))
  ), expected as (
    select distinct hs.id, private.habit_period_start(hs.habit, d::date) as ps
      from hs cross join generate_series(p_week_start::timestamp, (p_week_start + 6)::timestamp, interval '1 day') d
     where hs.period = 'day' or private.habit_period_start(hs.habit, d::date) >= p_week_start
  )
  select count(distinct e.id) >= 2
     and coalesce(bool_and(coalesce(x.outcome in ('done', 'skipped'), false)), false)
     and count(distinct e.id) filter (where x.outcome = 'done') >= 2
    from expected e left join public.period_results x on x.habit_id = e.id and x.period_start = e.ps;
$$;

-- Hooks. Each judges one moment (p_at) for the people it concerns. They only read; the awards are
-- written at once (p_sync, the default) or queued for sync_deferred_levels (the reward triggers).
create function private.badges_on_habit(p_habit public.habits, p_quiet boolean default false)
returns void
language sql
set search_path = ''
as $$
  select private.award_badge(coalesce(p_habit.created_by, p_habit.owner_id), 'planted', p_habit.created_at, p_quiet);
$$;

create function private.badges_on_check_in(p_check_in public.check_ins, p_quiet boolean default false,
  p_sync boolean default true, p_late boolean default false)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_category public.habit_category;
  v_at timestamptz := p_check_in.created_at;
begin
  if p_check_in.status <> 'approved' then
    return;
  end if;
  perform private.award_badge(p_check_in.user_id, 'first_step', v_at, p_quiet, p_sync, p_late);
  select h.category into v_category from public.habits h where h.id = p_check_in.habit_id;
  if v_category in ('fitness', 'home') and (
       select count(*) from public.check_ins c join public.habits h on h.id = c.habit_id
        where c.user_id = p_check_in.user_id and c.status = 'approved' and h.category = v_category and c.created_at <= v_at) >= 50 then
    perform private.award_badge(p_check_in.user_id, case v_category when 'fitness' then 'mover' else 'home_keeper' end, v_at, p_quiet, p_sync, p_late);
  end if;
  if private.full_day(p_check_in.user_id, p_check_in.local_date) then
    perform private.award_badge(p_check_in.user_id, 'full_day', v_at, p_quiet, p_sync, p_late);
  end if;
end;
$$;

create function private.badges_on_review(p_check_in public.check_ins, p_quiet boolean default false, p_sync boolean default true)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_check_in.status <> 'approved' or p_check_in.reviewed_by is null then
    return;
  end if;
  if (select count(*) from public.check_ins c
       where c.reviewed_by = p_check_in.reviewed_by and c.status = 'approved'
         and c.reviewed_at <= coalesce(p_check_in.reviewed_at, now())) >= 20 then
    perform private.award_badge(p_check_in.reviewed_by, 'fair_judge', coalesce(p_check_in.reviewed_at, now()), p_quiet, p_sync);
  end if;
end;
$$;

create function private.badges_on_cheer(p_user uuid, p_at timestamptz, p_quiet boolean default false)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.cheers c where c.user_id = p_user and c.created_at <= p_at) >= 20 then
    perform private.award_badge(p_user, 'cheerleader', p_at, p_quiet);
  end if;
end;
$$;

-- A settled period: rested → Rest well for the owner; done → the streak, category and family badges
-- for everyone it paid period XP to (the owner, or each required member of a group period).
create function private.badges_on_period(p_habit public.habits, p_period_start date, p_outcome text, p_at timestamptz default now(),
  p_quiet boolean default false, p_sync boolean default true, p_late boolean default false)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_run int;
  v_start date;
  v_month date := date_trunc('month', p_period_start::timestamp)::date;
  v_next date := (date_trunc('month', p_period_start::timestamp) + interval '1 month')::date;
  v_count int;
  v_need int;
  v_code text;
  u uuid;
begin
  if p_outcome = 'rested' then
    perform private.award_badge(p_habit.owner_id, 'rest_well', p_at, p_quiet, p_sync, p_late);
    return;
  end if;
  if p_outcome <> 'done' then
    return;
  end if;
  select s.run, s.started_on into v_run, v_start from private.streak_at(p_habit, p_period_start) s;
  for u in
    select x.user_id from public.xp_events x
     where x.reason = 'period_done' and x.source_type = 'period' and x.source_id = p_habit.id || ':' || p_period_start
     order by x.user_id
  loop
    if v_run >= 7 then
      perform private.award_badge(u, 'first_week', p_at, p_quiet, p_sync, p_late);
    end if;
    if p_habit.period = 'day' then
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
    if v_run >= 7 and exists (
         select 1 from public.period_results m
          where m.habit_id = p_habit.id and m.outcome = 'missed' and m.period_start < v_start
            and exists (select 1 from public.period_results d where d.habit_id = p_habit.id and d.outcome = 'done' and d.period_start < m.period_start)) then
      perform private.award_badge(u, 'back_on_track', p_at, p_quiet, p_sync, p_late);
    end if;
    if (p_habit.period = 'week'
        and (select count(*) from public.period_results x where x.habit_id = p_habit.id and x.outcome = 'done'
              and x.period_start >= v_month and x.period_start < v_next) >= 4
        and not exists (select 1 from public.period_results x where x.habit_id = p_habit.id and x.outcome in ('missed', 'rested')
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
    if p_habit.period in ('day', 'week')
       and private.perfect_week(u, private.period_start('week', p_period_start, (select p.week_start from public.profiles p where p.id = u))) then
      perform private.award_badge(u, 'perfect_week', p_at, p_quiet, p_sync, p_late);
    end if;
  end loop;
end;
$$;

-- Copied from 20261009100000_xp_ledger.sql (its latest definition). New: the badges, judged after the
-- XP and queued (p_sync = false), so they're written with the levels (Locks, at the top); late when
-- the check-in arrived after its period.
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
begin
  if new.status <> 'approved' or (tg_op = 'UPDATE' and old.status = 'approved') then
    return new;
  end if;
  -- Will this check-in upgrade a settled period (check_in_impl / review_check_in_impl call
  -- resettle_period right after, and it upgrades exactly when this holds)? Then the members' period
  -- grants follow, and everyone's levels are synced once, together, by the period trigger.
  if exists (select 1 from public.period_results x
              where x.habit_id = new.habit_id and x.period_start = new.period_start and x.outcome in ('missed', 'skipped')) then
    select h.* into v_habit from public.habits h where h.id = new.habit_id;
    v_upgrade := private.period_outcome(v_habit, new.period_start) = 'done';
  end if;
  for r in
    select v.who, v.amount, v.reason
      from (values (new.user_id, 10, 'check_in'),
                   (case when tg_op = 'UPDATE' and new.reviewed_by is distinct from new.user_id then new.reviewed_by end,
                    2, 'approval')) v(who, amount, reason)
     where v.who is not null
     order by v.who
  loop
    perform private.grant_xp(r.who, r.amount, r.reason, 'check_in', new.id::text, new.habit_id,
      case when tg_op = 'UPDATE' then coalesce(new.reviewed_at, new.created_at) else new.created_at end,
      false, false);
  end loop;
  if v_habit.id is null then
    select h.* into v_habit from public.habits h where h.id = new.habit_id;
  end if;
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

-- Copied from 20261010100000_streak_milestones.sql (its latest definition). New: a done period's
-- badges, after the XP and milestones, at the same moment (v_at) and late flag, queued for the sync
-- below (or finalize's, after its loop).
create or replace function private.rewards_on_period_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_habit public.habits;
  v_at timestamptz := new.finalized_at;
  v_late boolean := false;
  v_check_in public.check_ins;
begin
  if tg_op = 'UPDATE' and new.outcome is not distinct from old.outcome then
    return new;
  end if;
  select h.* into v_habit from public.habits h where h.id = new.habit_id;
  if not found then
    return new;
  end if;
  if new.outcome = 'done' then
    if tg_op = 'UPDATE' then
      -- The tap or approval that made it done: the latest approved check-in in the period.
      select c.* into v_check_in from public.check_ins c
       where c.habit_id = new.habit_id and c.period_start = new.period_start and c.status = 'approved'
       order by coalesce(c.reviewed_at, c.created_at) desc, c.id desc limit 1;
      v_late := found and private.is_late_check_in(v_habit, v_check_in);
      v_at := coalesce(v_check_in.reviewed_at, v_check_in.created_at, now());
    end if;
    perform private.grant_period_xp(v_habit, new.period_start, v_at, false, false);
    perform private.period_milestones(v_habit, new.period_start, v_at, false, false, v_late);
    perform private.badges_on_period(v_habit, new.period_start, 'done', v_at, false, false, v_late);
  end if;
  -- Levels (and badges) are synced once for everyone, in user id order: inside finalize's habit loop,
  -- after the loop (finalize does it); otherwise now, together with an upgrading check-in's author and
  -- reviewer, deferred by rewards_on_check_in (Locks, at the top).
  if current_setting('keepup.defer_levels', true) is distinct from 'on' then
    perform private.sync_deferred_levels();
  end if;
  return new;
end;
$$;

create function private.badges_on_habit_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.badges_on_habit(new);
  return new;
end;
$$;
create trigger habits_badges after insert on public.habits
  for each row execute function private.badges_on_habit_insert();

create function private.badges_on_cheer_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.badges_on_cheer(new.user_id, new.created_at);
  return new;
end;
$$;
create trigger cheers_badges after insert on public.cheers
  for each row execute function private.badges_on_cheer_insert();

-- Copied from 20261009100000_xp_ledger.sql (its latest definition). New: the child's badges go too.
create or replace function private.reset_child_impl(p_actor uuid, p_child_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.require_admin(private.require_guardian(p_actor, p_child_id), p_actor);
  delete from public.habits where owner_id = p_child_id;
  delete from public.check_ins where user_id = p_child_id;
  delete from public.habit_freezes where user_id = p_child_id;
  delete from public.group_habit_participants where profile_id = p_child_id;
  delete from public.treat_goals where child_id = p_child_id;
  delete from public.notifications where subject_id = p_child_id or user_id = p_child_id;
  delete from public.nudges where recipient_id = p_child_id;
  delete from public.xp_events where user_id = p_child_id;
  delete from public.level_ups where user_id = p_child_id;
  delete from public.user_achievements where user_id = p_child_id;
end;
$$;

-- For the app (PR 9).
create function private.set_celebrations_impl(p_user uuid, p_mode text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_mode is null or p_mode not in ('full', 'subtle') then
    raise exception 'keepup:invalid_choice' using errcode = 'P0001';
  end if;
  update public.profiles set celebrations = p_mode where id = p_user;
end;
$$;

create function public.set_celebrations(p_mode text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  perform private.set_celebrations_impl(auth.uid(), p_mode);
end;
$$;

create function public.mark_badges_seen(p_codes text[])
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_n int;
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  update public.user_achievements set seen_at = now()
   where user_id = auth.uid() and seen_at is null and achievement_code = any (coalesce(p_codes, '{}'));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke execute on function public.set_celebrations(text), public.mark_badges_seen(text[]) from public, anon;
grant execute on function public.set_celebrations(text), public.mark_badges_seen(text[]) to authenticated;

-- Past history, quietly (dated when earned, marked seen, no Inbox rows). Returns how many were new.
-- A period is judged at the latest of its settling and its period XP (a late upgrade pays at the tap,
-- after finalized_at), so the ledger counts include it.
create function private.backfill_badges()
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_before int;
  r record;
begin
  select count(*) into v_before from public.user_achievements;
  for r in select h from public.habits h order by h.created_at, h.id loop
    perform private.badges_on_habit(r.h, true);
  end loop;
  for r in select c from public.check_ins c where c.status = 'approved' order by c.created_at, c.id loop
    perform private.badges_on_check_in(r.c, true);
    perform private.badges_on_review(r.c, true);
  end loop;
  for r in select ch.user_id, ch.created_at from public.cheers ch order by ch.created_at loop
    perform private.badges_on_cheer(r.user_id, r.created_at, true);
  end loop;
  for r in select h as habit, x.period_start, x.outcome,
                  greatest(x.finalized_at, (select max(e.created_at) from public.xp_events e
                                             where e.reason = 'period_done' and e.source_type = 'period'
                                               and e.source_id = h.id || ':' || x.period_start)) as at
             from public.period_results x join public.habits h on h.id = x.habit_id
            where x.outcome = 'done' order by x.habit_id, x.period_start loop
    perform private.badges_on_period(r.habit, r.period_start, r.outcome, r.at, true);
  end loop;
  return (select count(*)::int from public.user_achievements) - v_before;
end;
$$;

select private.backfill_badges();
