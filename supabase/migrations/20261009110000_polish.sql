-- Polish from ideas/design-review-backlog.md and ideas/m3-followups.md (owner, 2026-10-04). Every
-- function replaced below is copied from its latest (and only) definition; only the parts its comment
-- names change.

-- 1. Invite landing with the group avatar. Copied from 20260930100000_groups.sql; two columns added.
-- A function's result columns can't change in place: drop and recreate, then restore the grants.
drop function public.invite_preview(text);
drop function private.invite_preview_impl(text, timestamptz);
create function private.invite_preview_impl(p_token text, p_now timestamptz)
returns table (group_name text, group_kind text, inviter_name text, member_count int, avatar_emoji text, avatar_color text)
language sql
stable
set search_path = ''
as $$
  select g.name, g.kind, split_part(coalesce(p.display_name, ''), ' ', 1),
         (select count(*)::int from public.group_members m where m.group_id = g.id and m.left_at is null),
         g.avatar_emoji, g.avatar_color
    from public.group_invites i
    join public.groups g on g.id = i.group_id
    left join public.profiles p on p.id = i.created_by
   where i.token = p_token and i.revoked_at is null and i.expires_at > p_now;
$$;
-- Callable by signed-out visitors (decision 0011).
create function public.invite_preview(p_token text)
returns table (group_name text, group_kind text, inviter_name text, member_count int, avatar_emoji text, avatar_color text)
language sql stable security definer set search_path = '' as $$
  select * from private.invite_preview_impl(p_token, now());
$$;
revoke execute on function public.invite_preview(text) from public;
grant execute on function public.invite_preview(text) to anon, authenticated;

-- 2. Inbox avatars. Copied from 20260930100300_feed_nudges_cheers.sql; the actor's avatar is new.
drop function public.inbox_feed(int);
drop function private.inbox_feed_impl(uuid, int);
create function private.inbox_feed_impl(p_user uuid, p_limit int)
returns table (
  id uuid, kind text, created_at timestamptz, read_at timestamptz, seen_at timestamptz,
  group_id uuid, group_name text, habit_id uuid, habit_title text, habit_emoji text, check_in_id uuid,
  actor_name text, actor_avatar_emoji text, actor_avatar_color text,
  subject_id uuid, subject_name text, subject_avatar_emoji text, payload jsonb)
language sql
stable
set search_path = ''
as $$
  select n.id, n.kind, n.created_at, n.read_at, n.seen_at, n.group_id, g.name, n.habit_id, h.title, h.emoji, n.check_in_id,
         a.display_name, a.avatar_emoji, a.avatar_color, n.subject_id, s.display_name, s.avatar_emoji, n.payload
    from public.notifications n
    left join public.groups g on g.id = n.group_id
    left join public.habits h on h.id = n.habit_id
    left join public.profiles a on a.id = n.actor_id
    left join public.profiles s on s.id = n.subject_id
   where n.user_id = p_user
   order by n.created_at desc
   limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;
create function public.inbox_feed(p_limit int default 50)
returns table (
  id uuid, kind text, created_at timestamptz, read_at timestamptz, seen_at timestamptz,
  group_id uuid, group_name text, habit_id uuid, habit_title text, habit_emoji text, check_in_id uuid,
  actor_name text, actor_avatar_emoji text, actor_avatar_color text,
  subject_id uuid, subject_name text, subject_avatar_emoji text, payload jsonb)
language sql stable security definer set search_path = '' as $$
  select * from private.inbox_feed_impl(auth.uid(), p_limit);
$$;
revoke execute on function public.inbox_feed(int) from public, anon;
grant execute on function public.inbox_feed(int) to authenticated;

-- 3. "By the child" is recorded when the check-in is made (m3-followups T3): logged_by is set null
-- when the logging adult deletes their account, which made the export call it the child's own tap.
-- Old rows: the best guess left is the current logged_by.
alter table public.check_ins add column by_child boolean not null default false;
update public.check_ins c set by_child = true
 where c.logged_by is null and exists (select 1 from public.profiles p where p.id = c.user_id and p.kind = 'child');
create function private.check_ins_set_by_child()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.by_child := new.logged_by is null;
  return new;
end;
$$;
create trigger check_ins_set_by_child before insert on public.check_ins
  for each row execute function private.check_ins_set_by_child();

-- Copied from 20260930100200_children.sql; by_child reads the column.
create or replace function private.export_child_impl(p_actor uuid, p_child_id uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  perform private.require_guardian(p_actor, p_child_id);
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select jsonb_build_object('name', c.display_name, 'avatar_emoji', c.avatar_emoji,
                                          'avatar_color', c.avatar_color, 'created_at', c.created_at)
                  from public.profiles c where c.id = p_child_id),
    'habits', coalesce((select jsonb_agg(jsonb_build_object(
                  'title', h.title, 'emoji', h.emoji, 'target_count', h.target_count, 'period', h.period,
                  'starts_on', h.starts_on, 'archived_at', h.archived_at) order by h.created_at)
                from public.habits h where h.owner_id = p_child_id), '[]'::jsonb),
    'check_ins', coalesce((select jsonb_agg(jsonb_build_object(
                  'habit', h.title, 'local_date', c.local_date, 'status', c.status,
                  'by_child', c.by_child, 'created_at', c.created_at) order by c.created_at)
                from public.check_ins c join public.habits h on h.id = c.habit_id
               where c.user_id = p_child_id), '[]'::jsonb),
    'treat_goals', coalesce((select jsonb_agg(jsonb_build_object(
                  'title', g.title, 'emoji', g.emoji, 'target', g.target, 'created_at', g.created_at,
                  'reached_at', g.reached_at, 'received_at', g.received_at) order by g.created_at)
                from public.treat_goals g where g.child_id = p_child_id), '[]'::jsonb));
end;
$$;

-- 4. A treat goal reached by a star that is undone is not reached any more (m3-followups T5), while
-- it hasn't been received. (The "reached" note already sent stays in the feed.)
-- A cascade (the habit or an account deleted) is not an undo, as in xp_on_check_in_deleted. The
-- child's row is locked FOR NO KEY UPDATE first, like kid_rewards_on_check_in, so a tap that reaches
-- the goal and an undo that un-reaches it serialize (lock order habit, check-in, profile, goal) and
-- the count below sees the other's committed check-in.
create function private.kid_goal_unreach()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.habits h where h.id = old.habit_id)
     or private.child_group(old.user_id) is null then
    return null; -- a cascade, or not a child
  end if;
  perform 1 from public.profiles p where p.id = old.user_id for no key update;
  update public.treat_goals g set reached_at = null
   where g.child_id = old.user_id and g.received_at is null and g.reached_at is not null
     and (select count(*) from public.check_ins c
           where c.user_id = old.user_id and c.status = 'approved' and c.created_at >= g.created_at) < g.target;
  return null;
end;
$$;
create trigger check_ins_kid_goal_unreach after delete on public.check_ins
  for each row when (old.status = 'approved') execute function private.kid_goal_unreach();

-- 5. Copied from 20260930100000_groups.sql. New: the group row is held (for share) before the member
-- row is written, so a join racing the last member's leave (which deletes the group) gets
-- invite_invalid, not a raw 23503 (m3-followups T1).
create or replace function private.accept_invite_impl(p_user_id uuid, p_token text, p_now timestamptz)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_invite public.group_invites;
begin
  select i.* into v_invite from public.group_invites i where i.token = p_token;
  if not found or v_invite.revoked_at is not null or v_invite.expires_at <= p_now then
    raise exception 'keepup:invite_invalid' using errcode = 'P0001';
  end if;
  if (select p.kind from public.profiles p where p.id = p_user_id) is distinct from 'adult' then
    raise exception 'keepup:not_an_adult' using errcode = 'P0001';
  end if;
  perform 1 from public.groups g where g.id = v_invite.group_id for share;
  if not found then
    raise exception 'keepup:invite_invalid' using errcode = 'P0001';
  end if;

  insert into public.group_members (group_id, user_id, role, joined_at)
  values (v_invite.group_id, p_user_id, 'member', p_now)
  on conflict (group_id, user_id) do update
     set left_at = null, joined_at = excluded.joined_at, role = 'member'
   where public.group_members.left_at is not null;
  return v_invite.group_id;
end;
$$;
