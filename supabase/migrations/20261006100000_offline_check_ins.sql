-- Offline-safe check-ins (ideas/offline.md §2, §4; decisions 2026-09-29; decision 0015). Every
-- function replaced below is copied from its latest definition; only the parts its comment names change.
--
-- Lock order stays habit row → check-in row → period_results row (20261001100000_db_hardening.sql):
-- every function here that touches a check-in or a period result holds the habit first.
--
-- XP: none exists yet. M5 must grant XP when a period_results row is upgraded (an UPDATE), not only on
-- insert. The insert-only period_results feed (milestones) doesn't fire for an upgrade either.

alter table public.check_ins
  add column client_id uuid unique,
  add column tapped_at timestamptz;

-- The review deadline of one check-in: period end + 12h, or 12h from arrival for a late arrival
-- that came after that (decision 2026-09-29). private.review_deadline stays the per-period window
-- (in_grace, habit_streaks and the calendar still use it: a period waits for its on-time reviews).
create function private.check_in_deadline(p_habit public.habits, p_check_in public.check_ins)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
    when p_check_in.created_at >= private.review_deadline(p_habit, p_check_in.period_start)
      then p_check_in.created_at + interval '12 hours'
    else private.review_deadline(p_habit, p_check_in.period_start)
  end;
$$;

-- A settled period that is done after all (a late tap, or an approval in time): upgrade it. Never the
-- other way round. When it was missed and its "streak ended" note went out, say the streak is back.
-- Locks: runs under the habit lock its caller holds; it then locks the period_results row
-- (habit → check-in → period_results).
create function private.resettle_period(p_habit public.habits, p_period_start date)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_old text;
begin
  select r.outcome into v_old from public.period_results r
   where r.habit_id = p_habit.id and r.period_start = p_period_start for update;
  if v_old is null or v_old not in ('missed', 'skipped') or private.period_outcome(p_habit, p_period_start) <> 'done' then
    return;
  end if;
  update public.period_results set outcome = 'done' where habit_id = p_habit.id and period_start = p_period_start;
  if v_old <> 'missed' then
    return;
  end if;
  if p_habit.group_id is not null then
    if exists (select 1 from public.notifications n
                where n.kind = 'group_streak_ended' and n.habit_id = p_habit.id
                  and n.dedupe_key like 'group_streak_ended:' || p_habit.id || ':' || p_period_start || ':%') then
      perform private.notify(private.group_adults(p_habit.group_id, null), 'streak_back',
        'streak_back:' || p_habit.id || ':' || p_period_start, p_habit.group_id, p_habit.id, null, null, null,
        jsonb_build_object('period_start', p_period_start));
    end if;
  elsif exists (select 1 from public.notifications n
                 where n.kind = 'private_streak_ended' and n.habit_id = p_habit.id
                   and n.dedupe_key like 'private_streak_ended:' || p_habit.id || ':' || p_period_start || ':%') then
    perform private.notify(array[p_habit.owner_id], 'streak_back',
      'streak_back:' || p_habit.id || ':' || p_period_start, null, p_habit.id, null, null, null,
      jsonb_build_object('period_start', p_period_start));
  end if;
end;
$$;

-- Copied from 20260930100100_group_habits.sql (its latest definition). New: p_client_id (one tap, one
-- check-in) and p_tapped_at (the day it was tapped counts, 3 days back at most, 5 minutes ahead at
-- most); a late tap may land in a settled period and upgrade it; a duplicate for a child from another
-- adult merges quietly.
-- Locks: the habit row first (as before), so a resend, a double tap, two parents, a review and
-- finalize all serialise on it; then the check-in insert; then resettle_period's period_results row.
drop function private.check_in_impl(uuid, uuid, timestamptz, uuid, boolean);

create function private.check_in_impl(
  p_habit_id uuid, p_actor uuid, p_now timestamptz, p_subject uuid default null, p_by_child boolean default false,
  p_client_id uuid default null, p_tapped_at timestamptz default null)
returns public.check_ins
language plpgsql
set search_path = ''
as $$
declare
  v_subject uuid := coalesce(p_subject, p_actor);
  v_kind text;
  v_habit public.habits;
  v_tap timestamptz := coalesce(p_tapped_at, p_now);
  v_today date;
  v_start date;
  v_count int;
  v_settled boolean;
  v_status text := 'approved';
  v_row public.check_ins;
begin
  if not private.can_act_for(p_actor, v_subject) then
    raise exception 'keepup:habit_not_found' using errcode = 'P0002';
  end if;
  select p.kind into v_kind from public.profiles p where p.id = v_subject;
  if p_by_child and v_kind is distinct from 'child' then
    raise exception 'keepup:not_a_child' using errcode = 'P0001';
  end if;

  -- The row lock serialises concurrent check-ins on this habit (a double tap, two parents, a resend).
  select h.* into v_habit from public.habits h where h.id = p_habit_id for update;
  if not found or not private.takes_part(v_habit, v_subject) then
    raise exception 'keepup:habit_not_found' using errcode = 'P0002';
  end if;

  -- One tap, one check-in: a resent tap returns the row it already made.
  if p_client_id is not null then
    select c.* into v_row from public.check_ins c where c.client_id = p_client_id;
    if found then
      if v_row.habit_id <> p_habit_id or v_row.user_id <> v_subject then
        raise exception 'keepup:check_in_not_found' using errcode = 'P0002';
      end if;
      return v_row;
    end if;
  end if;

  if p_tapped_at is not null and p_tapped_at > p_now + interval '5 minutes' then
    raise exception 'keepup:tap_in_future' using errcode = 'P0001';
  end if;
  if p_tapped_at is not null and p_tapped_at < p_now - interval '3 days' then
    perform private.notify(array[p_actor], 'sync_dropped', 'sync_dropped:' || p_client_id,
      coalesce(v_habit.group_id, private.child_group(v_habit.owner_id)), p_habit_id, null, null,
      case when v_subject <> p_actor then v_subject end,
      jsonb_build_object('tapped_on', private.habit_today(v_habit, p_tapped_at)));
    return null;
  end if;

  if v_habit.archived_at is not null then
    raise exception 'keepup:habit_archived' using errcode = 'P0001';
  end if;

  v_today := private.habit_today(v_habit, v_tap);
  if v_today < v_habit.starts_on then
    raise exception 'keepup:habit_not_started' using errcode = 'P0001';
  end if;
  v_start := private.habit_period_start(v_habit, v_today);

  -- A settled period takes only a late tap (within the 3 days above). An online tap is always in the
  -- open period, so for it this is the old "no backfill" rule.
  v_settled := exists (select 1 from public.period_results r where r.habit_id = p_habit_id and r.period_start = v_start);
  if v_settled and p_tapped_at is null then
    raise exception 'keepup:period_closed' using errcode = 'P0001';
  end if;

  if private.is_frozen(p_habit_id, v_today, v_today + 1)
     or private.is_member_frozen(p_habit_id, v_subject, v_today, v_today + 1) then
    raise exception 'keepup:habit_frozen' using errcode = 'P0001';
  end if;

  select count(*) into v_count from public.check_ins c
   where c.habit_id = p_habit_id and c.user_id = v_subject
     and c.period_start = v_start and c.status <> 'rejected';
  if v_count >= v_habit.target_count
     or (v_habit.period <> 'day' and exists (
           select 1 from public.check_ins c
            where c.habit_id = p_habit_id and c.user_id = v_subject
              and c.local_date = v_today and c.status <> 'rejected')) then
    -- Quiet merge (ideas/offline.md §4): another adult already logged it for the child.
    if p_client_id is not null and v_subject <> p_actor then
      select c.* into v_row from public.check_ins c
       where c.habit_id = p_habit_id and c.user_id = v_subject and c.period_start = v_start
         and c.status <> 'rejected' and c.logged_by is distinct from p_actor
       order by c.created_at desc limit 1;
      if found then
        perform private.notify(array[p_actor], 'already_logged', 'already_logged:' || p_client_id,
          coalesce(v_habit.group_id, private.child_group(v_habit.owner_id)), p_habit_id, v_row.id, v_row.logged_by, v_subject, '{}'::jsonb);
        return v_row;
      end if;
    end if;
    if v_count >= v_habit.target_count then
      raise exception 'keepup:target_reached' using errcode = 'P0001';
    end if;
    raise exception 'keepup:already_checked_in_today' using errcode = 'P0001';
  end if;

  -- Approval applies to an adult's own part only (a child's part never waits), and only when the
  -- group had at least two adults at the period's (effective) start (spec: Check-ins).
  if v_habit.requires_approval and v_kind = 'adult' and (
       select count(*) from public.group_members m
        where m.group_id = v_habit.group_id
          and m.joined_at <= greatest(private.local_midnight(v_start, private.habit_timezone(v_habit)), v_habit.created_at)
          and (m.left_at is null or m.left_at > greatest(private.local_midnight(v_start, private.habit_timezone(v_habit)), v_habit.created_at))
     ) >= 2 then
    v_status := 'pending';
  end if;

  insert into public.check_ins (habit_id, user_id, local_date, period_start, created_at, status, logged_by, client_id, tapped_at)
  values (p_habit_id, v_subject, v_today, v_start, p_now, v_status, case when p_by_child then null else p_actor end, p_client_id, p_tapped_at)
  returning * into v_row;

  if v_settled and v_status = 'approved' then
    perform private.resettle_period(v_habit, v_start);
  end if;
  return v_row;
end;
$$;

-- Copied from 20260929100300_check_ins.sql. New: the optional p_client_id and p_tapped_at. The old
-- one-argument signature is dropped so exactly one public.check_in remains (a second overload would
-- make check_in(uuid) ambiguous); old callers still work through the defaults.
drop function public.check_in(uuid);
create function public.check_in(p_habit_id uuid, p_client_id uuid default null, p_tapped_at timestamptz default null)
returns public.check_ins
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'keepup:not_authenticated' using errcode = '42501';
  end if;
  return private.check_in_impl(p_habit_id, auth.uid(), now(), null, false, p_client_id, p_tapped_at);
end;
$$;

-- Copied from 20260930100100_group_habits.sql; the same two optional arguments, one signature left.
drop function public.check_in_for(uuid, uuid, boolean);
create function public.check_in_for(
  p_habit_id uuid, p_child_id uuid, p_by_child boolean default false, p_client_id uuid default null, p_tapped_at timestamptz default null)
returns public.check_ins language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  if p_child_id is null or p_child_id = auth.uid() then raise exception 'keepup:not_a_child' using errcode = 'P0001'; end if;
  return private.check_in_impl(p_habit_id, auth.uid(), now(), p_child_id, p_by_child, p_client_id, p_tapped_at);
end;
$$;

-- An undo made offline, applied with the normal rules at sync time (ideas/offline.md §4). Refused
-- after another member approved it, or once its period is over; the person gets a note.
-- Locks: habit → check-in. The first read only finds the habit; the check-in is read again under
-- FOR UPDATE after the habit lock, so a review, expiry or undo that got the habit first is seen (an
-- approved check-in is never deleted from a stale read).
create function private.undo_check_in_by_client_impl(p_client_id uuid, p_user uuid, p_now timestamptz)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_check_in public.check_ins;
  v_habit public.habits;
  v_reason text;
begin
  select c.* into v_check_in from public.check_ins c where c.client_id = p_client_id;
  if not found then
    return false; -- never arrived (dropped as too old) or already undone: nothing to do
  end if;
  if not private.can_act_for(p_user, v_check_in.user_id) then
    raise exception 'keepup:check_in_not_found' using errcode = 'P0002';
  end if;
  select h.* into v_habit from public.habits h where h.id = v_check_in.habit_id for update;
  select c.* into v_check_in from public.check_ins c where c.id = v_check_in.id for update;
  if not found then
    return false; -- undone meanwhile
  end if;
  v_reason := case
    when v_check_in.status = 'approved' and v_check_in.reviewed_by is not null then 'approved'
    when v_check_in.period_start <> private.habit_period_start(v_habit, private.habit_today(v_habit, p_now)) then 'period_closed'
  end;
  if v_reason is not null then
    perform private.notify(array[p_user], 'undo_dropped', 'undo_dropped:' || p_client_id,
      coalesce(v_habit.group_id, private.child_group(v_habit.owner_id)), v_habit.id, v_check_in.id, null,
      case when v_check_in.user_id <> p_user then v_check_in.user_id end, jsonb_build_object('reason', v_reason));
    return false;
  end if;
  delete from public.check_ins where id = v_check_in.id;
  return true;
end;
$$;

create function public.undo_check_in_by_client(p_client_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return private.undo_check_in_by_client_impl(p_client_id, auth.uid(), now());
end;
$$;

revoke execute on function
  public.check_in(uuid, uuid, timestamptz), public.check_in_for(uuid, uuid, boolean, uuid, timestamptz),
  public.undo_check_in_by_client(uuid)
  from public, anon;
grant execute on function
  public.check_in(uuid, uuid, timestamptz), public.check_in_for(uuid, uuid, boolean, uuid, timestamptz),
  public.undo_check_in_by_client(uuid)
  to authenticated;

-- Copied from 20261001110000_already_reviewed_by.sql (its latest definition, which keeps the
-- db_hardening lock order). New: the deadline is the check-in's own (check_in_deadline), and the
-- settled-period upgrade is resettle_period (missed or skipped → done, with "streak is back").
-- Locks: habit → check-in → period_results (resettle_period), unchanged.
create or replace function private.review_check_in_impl(p_check_in_id uuid, p_actor uuid, p_approve boolean, p_now timestamptz)
returns public.check_ins
language plpgsql
set search_path = ''
as $$
declare
  v_check_in public.check_ins;
  v_habit public.habits;
  v_habit_id uuid;
  v_reviewer text;
begin
  select c.habit_id into v_habit_id from public.check_ins c where c.id = p_check_in_id;
  if not found then
    raise exception 'keepup:check_in_not_found' using errcode = 'P0002';
  end if;
  perform 1 from public.habits h where h.id = v_habit_id for update;

  select c.* into v_check_in from public.check_ins c where c.id = p_check_in_id for update;
  if not found then
    raise exception 'keepup:check_in_not_found' using errcode = 'P0002';
  end if;
  select h.* into v_habit from public.habits h where h.id = v_check_in.habit_id;
  if v_habit.group_id is null or not private.is_member(v_habit.group_id, p_actor) then
    raise exception 'keepup:check_in_not_found' using errcode = 'P0002';
  end if;
  if v_check_in.user_id = p_actor then
    raise exception 'keepup:own_check_in' using errcode = 'P0001';
  end if;
  if v_check_in.status <> 'pending' then
    -- Only members get here (checked above), so the reviewer's name stays inside the group.
    -- An expired check-in, or one whose reviewer deleted their account, has no name to give.
    select p.display_name into v_reviewer from public.profiles p where p.id = v_check_in.reviewed_by;
    if v_reviewer is null then
      raise exception 'keepup:already_reviewed' using errcode = 'P0001';
    end if;
    raise exception 'keepup:already_reviewed' using errcode = 'P0001', detail = v_reviewer;
  end if;
  if p_now >= private.check_in_deadline(v_habit, v_check_in) then
    raise exception 'keepup:review_closed' using errcode = 'P0001';
  end if;

  update public.check_ins
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = p_actor, reviewed_at = p_now
   where id = p_check_in_id
  returning * into v_check_in;

  if p_approve then
    perform private.resettle_period(v_habit, v_check_in.period_start);
  end if;
  return v_check_in;
end;
$$;

-- Copied from 20261001100000_db_hardening.sql (its latest definition). New:
-- 1. A pending check-in expires at its own deadline (check_in_deadline), so a late arrival keeps its
--    12h even in a period that is already settled.
-- 2. The habit is locked before periods are settled. Before, nothing could add a check-in to a closed
--    period, so the insert could run unlocked. Now a late tap or a late approval can: without the lock,
--    finalize could settle "missed" from a snapshot without the late check-in while check_in_impl saw
--    no result yet, and both would commit. With it, whichever comes second sees the other (the insert
--    is a new statement, so READ COMMITTED reads what committed during the wait; check_in_impl then
--    finds the result and resettles). Only habits with a period to settle are locked, in id order.
-- Locks: habit (id order) → check-ins (expiry) → period_results, as before.
create or replace function private.finalize_periods(p_now timestamptz)
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_habit public.habits;
  v_step interval;
  v_current date;
  v_last date;
  v_inserted int;
  v_total int := 0;
begin
  for v_habit in
    select h.* from public.habits h
     where h.archived_at is null
        or exists (select 1 from public.check_ins c where c.habit_id = h.id and c.status = 'pending')
     order by h.id
  loop
    -- Archived habits aren't finalized, but a pending check-in on one still expires once its review
    -- window has passed (it can no longer be reviewed).
    if v_habit.archived_at is not null then
      if exists (select 1 from public.check_ins c
                  where c.habit_id = v_habit.id and c.status = 'pending'
                    and p_now >= private.check_in_deadline(v_habit, c)) then
        perform 1 from public.habits h where h.id = v_habit.id for update;
        update public.check_ins c set status = 'expired'
         where c.habit_id = v_habit.id and c.status = 'pending'
           and p_now >= private.check_in_deadline(v_habit, c);
      end if;
      continue;
    end if;

    v_step := private.period_step(v_habit.period);
    v_current := private.habit_period_start(v_habit, private.habit_today(v_habit, p_now));
    v_last := (v_current::timestamp - v_step)::date;
    -- Periods are at least a day long, so only the one just closed can still be in its 12h grace.
    if private.in_grace(v_habit, v_last, p_now) then
      v_last := (v_last::timestamp - v_step)::date;
    end if;

    if exists (select 1 from public.check_ins c
                where c.habit_id = v_habit.id and c.status = 'pending' and c.period_start <= v_last
                  and p_now >= private.check_in_deadline(v_habit, c)) then
      perform 1 from public.habits h where h.id = v_habit.id for update;
      update public.check_ins c set status = 'expired'
       where c.habit_id = v_habit.id and c.status = 'pending' and c.period_start <= v_last
         and p_now >= private.check_in_deadline(v_habit, c);
    end if;

    if exists (select 1
                 from generate_series(private.first_period_start(v_habit)::timestamp, v_last::timestamp, v_step) as s(d)
                where not exists (
                  select 1 from public.period_results x where x.habit_id = v_habit.id and x.period_start = s.d::date)) then
      perform 1 from public.habits h where h.id = v_habit.id for update;
    end if;

    insert into public.period_results (habit_id, period_start, outcome, finalized_at)
    select v_habit.id, s.d::date, private.period_outcome(v_habit, s.d::date), p_now
      from generate_series(private.first_period_start(v_habit)::timestamp, v_last::timestamp, v_step) as s(d)
     where not exists (
       select 1 from public.period_results x where x.habit_id = v_habit.id and x.period_start = s.d::date)
    on conflict (habit_id, period_start) do nothing;

    get diagnostics v_inserted = row_count;
    v_total := v_total + v_inserted;
  end loop;
  return v_total;
end;
$$;

-- Copied from 20260930100300_feed_nudges_cheers.sql (its latest definition); the deadline is the
-- check-in's own. Read-only: no locks.
create or replace function private.pending_approvals_impl(p_user uuid, p_now timestamptz)
returns table (
  check_in_id uuid, habit_id uuid, habit_title text, habit_emoji text, group_id uuid, group_name text,
  author_id uuid, author_name text, author_avatar_emoji text, author_avatar_color text,
  local_date date, created_at timestamptz, review_deadline timestamptz)
language sql
stable
set search_path = ''
as $$
  select c.id, h.id, h.title, h.emoji, g.id, g.name, p.id, p.display_name, p.avatar_emoji, p.avatar_color,
         c.local_date, c.created_at, private.check_in_deadline(h, c)
    from public.check_ins c
    join public.habits h on h.id = c.habit_id
    join public.groups g on g.id = h.group_id
    join public.profiles p on p.id = c.user_id
   where c.status = 'pending'
     and c.user_id <> p_user
     and private.is_member(h.group_id, p_user)
     and p_now < private.check_in_deadline(h, c)
   order by c.created_at;
$$;

-- Copied from 20261004100000_reminder_scheduler.sql (its latest definition, with the fix-round
-- locking and notify_count). New: the window is the check-in's own deadline (check_in_deadline).
-- Locks: as finalize_periods, habits in id order, each locked FOR UPDATE before its check-in is read
-- again, so a review or expiry that got there first (it holds the habit too) is seen and nothing is
-- written for it. Then the check-in and group are shared by the feed insert: habit → check-in → group.
create or replace function private.enqueue_expiring_approvals(p_now timestamptz)
returns int
language plpgsql
set search_path = ''
as $$
declare
  r record;
  v_n int := 0;
begin
  for r in
    select c.id, c.user_id, c.habit_id, h.group_id
      from public.check_ins c
      join public.habits h on h.id = c.habit_id
     where c.status = 'pending' and h.group_id is not null and h.archived_at is null
       and p_now >= private.check_in_deadline(h, c) - interval '2 hours'
       and p_now < private.check_in_deadline(h, c)
     order by h.id, c.id
  loop
    perform 1 from public.habits h where h.id = r.habit_id and h.archived_at is null for update;
    if not found then
      continue;
    end if;
    if not exists (select 1 from public.check_ins c where c.id = r.id and c.status = 'pending') then
      continue;
    end if;
    v_n := v_n + private.notify_count(private.group_adults(r.group_id, array[r.user_id]), 'approval_expiring',
      'expiring:' || r.id, r.group_id, r.habit_id, r.id, r.user_id, null, '{}'::jsonb);
  end loop;
  return v_n;
end;
$$;
