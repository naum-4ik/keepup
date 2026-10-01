-- M3 database hardening (follow-ups from the M3 final review). Every function below is copied from its
-- latest definition; only the parts named in its comment change.
--
-- Lock order, everywhere: group row → habit rows (ascending id) → check-in rows. Two transactions that
-- take locks in the same order wait for each other instead of deadlocking. pgTAP runs in one session,
-- so the orders are argued here rather than tested.

-- 1. Treat goals: cancel vs mark received (copied from 20260930100200_children.sql).
-- The goal row is locked, as mark_treat_received_impl does, so the two serialise: whichever comes
-- second re-reads the row (READ COMMITTED re-checks "received_at is null" after the lock wait) and
-- gets goal_not_found. The delete repeats the condition so a received goal is never deleted.
create or replace function private.cancel_treat_goal_impl(p_actor uuid, p_goal_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_goal public.treat_goals;
begin
  select g.* into v_goal from public.treat_goals g where g.id = p_goal_id and g.received_at is null for update;
  if not found or not private.can_act_for(p_actor, v_goal.child_id) then
    raise exception 'keepup:goal_not_found' using errcode = 'P0002';
  end if;
  delete from public.treat_goals where id = p_goal_id and received_at is null;
end;
$$;

-- 2. Invites (copied from 20260930100000_groups.sql). An active link is reused only while it has more
-- than a day left, so a copied link doesn't die an hour after it was shared. Otherwise a new 7-day
-- link is made; the older one stays valid until it expires (people may already have it).
create or replace function private.create_invite_impl(p_user_id uuid, p_group_id uuid, p_now timestamptz)
returns public.group_invites
language plpgsql
set search_path = ''
as $$
declare
  v_row public.group_invites;
begin
  perform 1 from public.groups g where g.id = p_group_id for update;
  perform private.require_admin(p_group_id, p_user_id);
  select i.* into v_row from public.group_invites i
   where i.group_id = p_group_id and i.revoked_at is null and i.expires_at > p_now + interval '1 day'
   order by i.expires_at desc
   limit 1;
  if found then
    return v_row;
  end if;
  insert into public.group_invites (group_id, created_by, created_at, expires_at)
  values (p_group_id, p_user_id, p_now, p_now + interval '7 days')
  returning * into v_row;
  return v_row;
end;
$$;

-- 3 + 9. Pause feed (copied from 20260930100300_feed_nudges_cheers.sql).
-- "Resumed" fires only when a whole-habit pause that has started (starts_on <= the habit's today)
-- ends early: deleted, or its end brought earlier. Cancelling a pause that hasn't started yet, or
-- extending one, fires nothing. auth.uid() stays the actor; null (cron, service) is "system": no
-- actor, and nobody is left out of the recipients (group_adults ignores null entries).
create or replace function private.feed_on_freeze()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.habit_freezes := case when tg_op = 'DELETE' then old else new end;
  v_habit public.habits;
  v_today date;
begin
  -- A cascade (habit or group deleted) finds no habit: write nothing.
  select h.* into v_habit from public.habits h where h.id = v_row.habit_id;
  if not found or v_habit.group_id is null then
    return v_row;
  end if;

  if tg_op = 'INSERT' and new.user_id is null then
    perform private.notify(private.group_adults(v_habit.group_id, array[new.created_by]), 'group_habit_paused',
      'group_habit_paused:' || new.id, v_habit.group_id, v_habit.id, null, new.created_by, null,
      jsonb_build_object('starts_on', new.starts_on, 'ends_on', new.ends_on));
  elsif tg_op = 'INSERT' then
    if (select p.kind from public.profiles p where p.id = new.user_id) = 'adult' then
      perform private.notify(private.group_adults(v_habit.group_id, array[new.user_id]), 'member_paused',
        'member_paused:' || new.id, v_habit.group_id, v_habit.id, null, new.user_id, null, '{}'::jsonb);
    end if;
  elsif v_row.user_id is null then
    v_today := private.habit_today(v_habit, now());
    if old.starts_on <= v_today
       and (tg_op = 'DELETE'
            or (new.ends_on is not null and (old.ends_on is null or new.ends_on < old.ends_on))) then
      perform private.notify(private.group_adults(v_habit.group_id, array[auth.uid()]), 'group_habit_resumed',
        'group_habit_resumed:' || v_habit.id || ':' || v_today, v_habit.group_id, v_habit.id,
        null, auth.uid(), null, '{}'::jsonb);
    end if;
  end if;
  return v_row;
end;
$$;

-- 9. Member feed (copied from 20260930100300_feed_nudges_cheers.sql). auth.uid() stays the actor. A
-- null auth.uid() (cron, service) is "system": "removed" is true only when a signed-in person other
-- than the leaver did it, so it stays false for someone leaving, whoever runs the statement. The
-- leaver and a null actor are never recipients (group_admins ignores null entries), so nobody hears
-- it twice.
create or replace function private.feed_on_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or (old.left_at is not null and new.left_at is null) then
    perform private.notify(private.group_adults(new.group_id, array[new.user_id]), 'member_joined',
      'member_joined:' || new.group_id || ':' || new.user_id || ':' || extract(epoch from new.joined_at)::bigint,
      new.group_id, null, null, new.user_id, null, '{}'::jsonb);
  elsif old.left_at is null and new.left_at is not null then
    perform private.notify(private.group_admins(new.group_id, array[new.user_id, auth.uid()]), 'member_left',
      'member_left:' || new.group_id || ':' || new.user_id || ':' || extract(epoch from new.left_at)::bigint,
      new.group_id, null, null, new.user_id, null,
      jsonb_build_object('removed', coalesce(auth.uid() <> new.user_id, false)));
  elsif old.role <> new.role then
    perform private.notify(array[new.user_id], 'role_changed', null, new.group_id, null, null, auth.uid(), null,
      jsonb_build_object('role', new.role));
  end if;
  return new;
end;
$$;

-- 4a. finalize_periods (copied from 20260930100100_group_habits.sql). Expiring pending check-ins
-- locks the habit row first (check_in_impl, undo_check_in_impl and review_check_in_impl all hold the
-- habit before touching its check-ins, and the feed trigger takes the habit after a check-in update,
-- so expiring without it could deadlock against a review). Habits are visited in id order, as
-- review_check_ins does, so locking several habits can't deadlock either; for that the archived
-- habits' expiry moves into the same ordered loop. Only habits that have something to expire are
-- locked, so the cron run doesn't hold every habit. Results are unchanged.
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
                    and p_now >= private.review_deadline(v_habit, c.period_start)) then
        perform 1 from public.habits h where h.id = v_habit.id for update;
        update public.check_ins c set status = 'expired'
         where c.habit_id = v_habit.id and c.status = 'pending'
           and p_now >= private.review_deadline(v_habit, c.period_start);
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
                where c.habit_id = v_habit.id and c.status = 'pending' and c.period_start <= v_last) then
      perform 1 from public.habits h where h.id = v_habit.id for update;
      update public.check_ins c set status = 'expired'
       where c.habit_id = v_habit.id and c.status = 'pending' and c.period_start <= v_last;
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

-- 4b. Deleting a child (copied from 20260930100200_children.sql). The cascade deletes her habits and
-- their check-ins; locking the habits first (id order) keeps habit → check-in, so a check-in being
-- logged on one of them (habit locked first) waits instead of deadlocking.
create or replace function private.delete_child_impl(p_actor uuid, p_child_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.require_admin(private.require_guardian(p_actor, p_child_id), p_actor);
  perform 1 from public.habits h where h.owner_id = p_child_id order by h.id for update;
  delete from public.profiles where id = p_child_id;
end;
$$;

-- 4c. The habits a group's deletion cascades to: its group habits and its children's habits, locked
-- in id order before the group goes (habit → check-in, as above). The caller holds the group row.
create function private.lock_group_habits(p_group_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.habits h
   where h.group_id = p_group_id
      or h.owner_id in (select c.id from public.profiles c where c.group_id = p_group_id and c.kind = 'child')
   order by h.id
     for update of h;
end;
$$;

-- Copied from 20260930100000_groups.sql; the group row is now locked first (as leave_group_impl
-- does; otherwise delete's habit → group order would cross leave's group → habit), then its habits.
create or replace function private.delete_group_impl(p_user_id uuid, p_group_id uuid, p_confirm_children boolean)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.groups g where g.id = p_group_id for update;
  perform private.require_admin(p_group_id, p_user_id);
  if private.group_has_children(p_group_id) and not coalesce(p_confirm_children, false) then
    raise exception 'keepup:children_would_be_deleted' using errcode = 'P0001';
  end if;
  perform private.lock_group_habits(p_group_id);
  delete from public.groups where id = p_group_id;
end;
$$;

-- Copied from 20260930100000_groups.sql; the delete path locks the group's habits first.
create or replace function private.leave_group_impl(p_user_id uuid, p_group_id uuid, p_confirm_children boolean, p_now timestamptz)
returns void
language plpgsql
set search_path = ''
as $$
begin
  -- Serialise membership changes of one group (two admins leaving at once).
  perform 1 from public.groups g where g.id = p_group_id for update;
  if not private.is_member(p_group_id, p_user_id) then
    raise exception 'keepup:group_not_found' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.group_members m
                  where m.group_id = p_group_id and m.left_at is null and m.user_id <> p_user_id) then
    if private.group_has_children(p_group_id) and not coalesce(p_confirm_children, false) then
      raise exception 'keepup:children_would_be_deleted' using errcode = 'P0001';
    end if;
    perform private.lock_group_habits(p_group_id);
    delete from public.groups where id = p_group_id;
    return;
  end if;

  if private.is_admin(p_group_id, p_user_id) and not exists (
    select 1 from public.group_members m
     where m.group_id = p_group_id and m.left_at is null and m.role = 'admin' and m.user_id <> p_user_id) then
    raise exception 'keepup:last_admin' using errcode = 'P0001';
  end if;

  update public.group_members set left_at = p_now where group_id = p_group_id and user_id = p_user_id;
end;
$$;

-- 5. Restore (copied from 20260930170000_restore_habit.sql). An approval habit's archive-day period
-- that is still in its review window isn't settled here: a pending check-in may still be approved,
-- and finalize_periods settles the period once the window closes.
create or replace function private.restore_habit_impl(p_actor uuid, p_habit_id uuid, p_now timestamptz)
returns public.habits
language plpgsql
set search_path = ''
as $$
declare
  v_habit public.habits := private.habit_for_update(p_habit_id);
  v_step interval;
  v_from date;
  v_current date;
begin
  perform private.require_habit_manager(p_actor, v_habit);
  if v_habit.archived_at is null then
    raise exception 'keepup:not_archived' using errcode = 'P0001';
  end if;
  if v_habit.finished_at is not null then
    raise exception 'keepup:habit_finished' using errcode = 'P0001';
  end if;
  v_step := private.period_step(v_habit.period);
  -- From the period it was archived in (unless done by then) up to the one before today's.
  v_from := greatest(private.habit_period_start(v_habit, private.habit_today(v_habit, v_habit.archived_at)),
                     private.first_period_start(v_habit));
  v_current := private.habit_period_start(v_habit, private.habit_today(v_habit, p_now));
  insert into public.period_results (habit_id, period_start, outcome, finalized_at)
  select v_habit.id, s.d::date,
         case when private.period_outcome(v_habit, s.d::date) = 'done' then 'done' else 'skipped' end, p_now
    from generate_series(v_from::timestamp, v_current::timestamp - v_step, v_step) as s(d)
   where not private.in_grace(v_habit, s.d::date, p_now)
  on conflict (habit_id, period_start) do nothing;
  perform set_config('keepup.restoring', 'on', true);
  update public.habits set archived_at = null where id = p_habit_id returning * into v_habit;
  perform set_config('keepup.restoring', '', true);
  return v_habit;
end;
$$;

-- 6. Removing a member (copied from 20260930100000_groups.sql). The last_admin guard is gone: the
-- caller is an admin and can't be the target, so another admin always remains. The group lock stays.
create or replace function private.remove_member_impl(p_user_id uuid, p_group_id uuid, p_target_id uuid, p_now timestamptz)
returns void
language plpgsql
set search_path = ''
as $$
begin
  -- Serialise membership changes of one group (two admins removing each other at once).
  perform 1 from public.groups g where g.id = p_group_id for update;
  perform private.require_admin(p_group_id, p_user_id);
  if p_target_id = p_user_id then
    raise exception 'keepup:use_leave' using errcode = 'P0001';
  end if;
  update public.group_members set left_at = p_now
   where group_id = p_group_id and user_id = p_target_id and left_at is null;
  if not found then
    raise exception 'keepup:member_not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- 7. RLS helper calls: every policy that calls is_group_member / is_group_admin / can_read_habit /
-- can_manage_habit / can_act_for_profile passes a row column (id, group_id, habit_id, child_id, or
-- c.habit_id in "cheers: read shared"), so there is no per-query constant to hoist into (select …).
-- No policy changes.

-- 10. The invite landing for someone already in the group: the group's id, so the page offers
-- "Open {group}" instead of Join. Signed-in callers only, and only for their own membership: the
-- anonymous invite_preview still never returns a group id.
create function private.invite_membership_impl(p_user_id uuid, p_token text)
returns uuid
language sql
stable
set search_path = ''
as $$
  select i.group_id from public.group_invites i
   where i.token = p_token and private.is_member(i.group_id, p_user_id);
$$;

create function public.invite_membership(p_token text)
returns uuid language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return private.invite_membership_impl(auth.uid(), p_token);
end;
$$;

revoke execute on function public.invite_membership(text) from public, anon;
grant execute on function public.invite_membership(text) to authenticated;
