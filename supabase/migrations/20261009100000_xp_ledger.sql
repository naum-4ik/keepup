-- M5 XP ledger and levels (ideas/achievements-and-rewards.md §3; spec: Data model). Every function or
-- constraint replaced below is copied from its latest definition; only the parts its comment names change:
--   notifications_kind_check   20261002100000_notification_prefs_push.sql
--   private.push_category      20261008100000_m4_followups.sql
--   private.push_allowed       20261006100000_offline_check_ins.sql
--   private.reset_child_impl   20260930130000_reset_child.sql
-- Lock order: habit → check-in → period_results → profiles (several profiles: in user id order).

-- 1. Every M5 kind at once (the app skips kinds it doesn't know; PR 1 knows them all).
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'group_check_in', 'approval_needed', 'check_in_approved', 'check_in_rejected', 'everyone_done',
  'group_streak_ended', 'group_milestone', 'group_habit_created', 'group_habit_paused', 'group_habit_resumed',
  'group_habit_archived', 'member_paused', 'member_joined', 'member_left', 'role_changed', 'nudge', 'cheer',
  'kid_check_in', 'kid_streak', 'kid_goal_reached', 'kid_garden_full',
  'private_streak_ended', 'daily_summary', 'habit_reminder', 'approval_expiring', 'streak_back',
  'already_logged', 'sync_dropped', 'undo_dropped',
  'level_up', 'badge_unlocked', 'streak_milestone', 'rest_day_used', 'weekly_recap', 'monthly_recap', 'family_recap'));

-- 2. The ledger (spec: Data model). Append-only: a grant is a row, an undo is a negative row, and the
-- unique key makes every grant idempotent. habit_id is for reading (badges, "Back to N"); it has no
-- foreign key, so nothing ever rewrites a row.
create table public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount int not null check (amount <> 0),
  reason text not null check (reason in ('check_in', 'check_in_undone', 'approval', 'period_done', 'milestone')),
  source_type text not null check (source_type in ('check_in', 'period', 'streak')),
  source_id text not null check (char_length(source_id) between 1 and 120),
  habit_id uuid,
  created_at timestamptz not null default now(),
  constraint xp_events_grant_once unique (user_id, reason, source_type, source_id)
);
create index xp_events_user_idx on public.xp_events (user_id, created_at);
create index xp_events_habit_idx on public.xp_events (habit_id, reason) where habit_id is not null;
alter table public.xp_events enable row level security;
create policy "xp_events: read own" on public.xp_events for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.xp_events from anon, authenticated;
grant select on public.xp_events to authenticated;

create function private.xp_events_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'keepup:ledger_append_only' using errcode = 'P0001';
end;
$$;
create trigger xp_events_append_only before update on public.xp_events
  for each row execute function private.xp_events_append_only();

-- Drives the celebration (spec: level_ups). A row stays when XP drops again, so crossing the same
-- line twice never celebrates twice.
create table public.level_ups (
  user_id uuid not null references public.profiles (id) on delete cascade,
  level int not null check (level >= 2),
  reached_at timestamptz not null default now(),
  seen_at timestamptz,
  primary key (user_id, level)
);
alter table public.level_ups enable row level security;
create policy "level_ups: read own" on public.level_ups for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.level_ups from anon, authenticated;
grant select on public.level_ups to authenticated;

-- 3. Levels: level = floor(sqrt(xp / 50)) + 1 (mirrored by lib/levels.ts).
create function private.level_for(p_xp bigint)
returns int
language sql
immutable
set search_path = ''
as $$
  select floor(sqrt(greatest(coalesce(p_xp, 0), 0) / 50.0))::int + 1;
$$;

-- Writes a level_ups row for every level reached and not recorded yet. One Inbox row per jump, for the
-- highest new level; none for children (no Inbox) and none when quiet (backfill: marked seen).
create function private.sync_level(p_user uuid, p_quiet boolean)
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
      jsonb_build_object('level', v_top));
  end if;
end;
$$;

-- The one way XP is granted. Locks the person's profile row (after any habit / check-in / result lock
-- the caller holds), so two grants for one person can't both miss a level boundary. A profile being
-- deleted (an account deletion cascading into check-ins) is skipped: false.
create function private.grant_xp(
  p_user uuid, p_amount int, p_reason text, p_source_type text, p_source_id text,
  p_habit_id uuid default null, p_at timestamptz default now(), p_quiet boolean default false)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.profiles p where p.id = p_user for update;
  if not found then
    return false;
  end if;
  insert into public.xp_events (user_id, amount, reason, source_type, source_id, habit_id, created_at)
  values (p_user, p_amount, p_reason, p_source_type, p_source_id, p_habit_id, coalesce(p_at, now()))
  on conflict on constraint xp_events_grant_once do nothing;
  if not found then
    return false;
  end if;
  perform private.sync_level(p_user, p_quiet);
  return true;
end;
$$;

-- +20 to a private habit's owner, +30 to each required member of a group period (children included,
-- behind the scenes). Profiles in user id order. Returns how many grants were new.
create function private.grant_period_xp(p_habit public.habits, p_period_start date, p_at timestamptz default now(), p_quiet boolean default false)
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_n int := 0;
  r record;
begin
  for r in
    select u.id
      from (select p_habit.owner_id as id where p_habit.group_id is null
            union
            select m.profile_id from private.required_members(p_habit, p_period_start) m(profile_id) where p_habit.group_id is not null) u
     where u.id is not null
     order by u.id
  loop
    if private.grant_xp(r.id, case when p_habit.group_id is null then 20 else 30 end, 'period_done', 'period',
                        p_habit.id || ':' || p_period_start, p_habit.id, p_at, p_quiet) then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$$;

-- 4. Check-ins: +10 when one counts (an approved insert, or pending → approved), and +2 to whoever
-- approved it. The two profiles are locked in user id order (lock order above).
create function private.rewards_on_check_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if new.status <> 'approved' or (tg_op = 'UPDATE' and old.status = 'approved') then
    return new;
  end if;
  for r in
    select v.who, v.amount, v.reason
      from (values (new.user_id, 10, 'check_in'),
                   (case when tg_op = 'UPDATE' then new.reviewed_by end, 2, 'approval')) v(who, amount, reason)
     where v.who is not null
     order by v.who
  loop
    perform private.grant_xp(r.who, r.amount, r.reason, 'check_in', new.id::text, new.habit_id);
  end loop;
  return new;
end;
$$;

create trigger check_ins_rewards after insert or update of status on public.check_ins
  for each row execute function private.rewards_on_check_in();

-- Undo (both undo paths delete the row): the author's +10 comes back as a negative row. The reviewer
-- keeps their +2 (reviews are final). A cascade (the habit or group deleted, an account deleted) is
-- not an undo: the habit is gone, or grant_xp finds no profile.
create function private.xp_on_check_in_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_amount int;
begin
  if not exists (select 1 from public.habits h where h.id = old.habit_id) then
    return old;
  end if;
  select x.amount into v_amount from public.xp_events x
   where x.user_id = old.user_id and x.reason = 'check_in' and x.source_type = 'check_in' and x.source_id = old.id::text;
  if v_amount is null then
    return old; -- it never counted (pending, rejected, expired)
  end if;
  perform private.grant_xp(old.user_id, -v_amount, 'check_in_undone', 'check_in', old.id::text, old.habit_id);
  return old;
end;
$$;

create trigger check_ins_xp_undo after delete on public.check_ins
  for each row execute function private.xp_on_check_in_deleted();

-- 5. Settled periods, on INSERT (finalize) and on UPDATE of outcome (resettle_period's late upgrade):
-- a done period pays out either way, once (the ledger key).
create function private.rewards_on_period_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_habit public.habits;
begin
  if tg_op = 'UPDATE' and new.outcome is not distinct from old.outcome then
    return new;
  end if;
  select h.* into v_habit from public.habits h where h.id = new.habit_id;
  if not found then
    return new;
  end if;
  if new.outcome = 'done' then
    perform private.grant_period_xp(v_habit, new.period_start);
  end if;
  return new;
end;
$$;

create trigger period_results_rewards after insert or update of outcome on public.period_results
  for each row execute function private.rewards_on_period_result();

-- 6. Achievements push (spec: Events #19, #20); the recaps and rest days join it. The family recap is
-- a group thing: Group updates, like the group milestone (owner 2026-10-04).
-- Copied from 20261008100000_m4_followups.sql; the last seven lines are new.
create or replace function private.push_category(p_kind text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'nudge' then 'nudges'
    when 'check_in_rejected' then 'always'
    when 'daily_summary' then 'reminders'
    when 'habit_reminder' then 'reminders'
    when 'approval_expiring' then 'approvals'
    when 'approval_needed' then 'approvals'
    when 'group_check_in' then 'group_activity'
    when 'everyone_done' then 'group_activity'
    when 'kid_goal_reached' then 'group_activity'
    when 'kid_garden_full' then 'group_activity'
    when 'kid_streak' then 'group_activity'
    when 'group_streak_ended' then 'group_updates'
    when 'streak_back' then 'group_updates'
    when 'group_habit_created' then 'group_updates'
    when 'group_habit_paused' then 'group_updates'
    when 'group_habit_resumed' then 'group_updates'
    when 'member_joined' then 'group_updates'
    when 'group_milestone' then 'group_updates'
    when 'family_recap' then 'group_updates'
    when 'level_up' then 'achievements'
    when 'badge_unlocked' then 'achievements'
    when 'streak_milestone' then 'achievements'
    when 'rest_day_used' then 'achievements'
    when 'weekly_recap' then 'achievements'
    when 'monthly_recap' then 'achievements'
  end;
$$;

-- Copied from 20261006100000_offline_check_ins.sql (its latest definition). New: with no preference
-- row, Achievements is Inbox only (owner 2026-10-04); every other category stays Silent.
create or replace function private.push_allowed(
  p_user uuid, p_kind text, p_habit_id uuid, p_group_id uuid, p_payload jsonb, p_now timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select c.category is not null
       and p.kind = 'adult'
       and (p.muted_until is null or p.muted_until <= p_now)
       and not coalesce(s.muted, false)
       and not (c.category = 'reminders' and p_habit_id is not null and not coalesce(s.reminders, true))
       and (c.category = 'always'
            or coalesce(np.delivery, case when c.category = 'achievements' then 'inbox' else 'silent' end) <> 'inbox')
       and (p_kind <> 'group_streak_ended'
            or (case when p_payload ->> 'streak' ~ '^\d{1,9}$' then (p_payload ->> 'streak')::int else 0 end) >= 3)
       and (p_kind <> 'member_joined' or private.is_admin(p_group_id, p_user))
       and (p_kind <> 'streak_back' or p_group_id is not null)
       and (p_kind not in ('group_check_in', 'everyone_done', 'kid_garden_full')
            or p_payload ->> 'late' is distinct from 'true')
      from (select private.push_category(p_kind) as category) c
      join public.profiles p on p.id = p_user
      left join public.habit_user_settings s on s.user_id = p_user and s.habit_id = p_habit_id
      left join public.notification_prefs np on np.user_id = p_user and np.category = c.category), false);
$$;

-- 7. Copied from 20260930130000_reset_child.sql. New: the child's XP and levels go too (a fresh start).
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
end;
$$;

-- 8. For the app (PR 6, PR 9).
create function public.my_level()
returns table (xp int, level int)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(x.amount), 0)::int, private.level_for(coalesce(sum(x.amount), 0))
    from public.xp_events x where x.user_id = auth.uid();
$$;

-- The moment shows the highest new level; every level up to it counts as seen.
create function public.mark_levels_seen(p_up_to int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  update public.level_ups set seen_at = now()
   where user_id = auth.uid() and seen_at is null and level <= coalesce(p_up_to, 0);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke execute on function public.my_level(), public.mark_levels_seen(int) from public, anon;
grant execute on function public.my_level(), public.mark_levels_seen(int) to authenticated;

-- 9. Count past history (decided 2026-09-29), quietly: no Inbox rows, no pushes, levels marked seen.
-- Idempotent through the ledger key; returns how many grants were new.
create function private.backfill_xp()
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_n int := 0;
  r record;
begin
  for r in
    select c.id, c.user_id, c.reviewed_by, c.habit_id, c.created_at, c.reviewed_at
      from public.check_ins c where c.status = 'approved' order by c.user_id, c.created_at, c.id
  loop
    if private.grant_xp(r.user_id, 10, 'check_in', 'check_in', r.id::text, r.habit_id, r.created_at, true) then
      v_n := v_n + 1;
    end if;
    if r.reviewed_by is not null
       and private.grant_xp(r.reviewed_by, 2, 'approval', 'check_in', r.id::text, r.habit_id, coalesce(r.reviewed_at, r.created_at), true) then
      v_n := v_n + 1;
    end if;
  end loop;
  for r in
    select h as habit, x.period_start, x.finalized_at
      from public.period_results x join public.habits h on h.id = x.habit_id
     where x.outcome = 'done' order by x.habit_id, x.period_start
  loop
    v_n := v_n + private.grant_period_xp(r.habit, r.period_start, r.finalized_at, true);
  end loop;
  return v_n;
end;
$$;

select private.backfill_xp();
