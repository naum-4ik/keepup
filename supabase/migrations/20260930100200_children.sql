-- M3 kids: child profiles (profiles.kind = 'child'), their habits, moving/deleting/exporting, and
-- treat goals. Any adult member of the child's group manages the child; only admins add, move or
-- delete one (ideas/kids-and-groups.md §1).

-- Kid habits have no category (flat kid templates). habit_rules (20260930100100) already refuses a
-- null category for anyone but a child.
alter table public.habits alter column category drop not null;

create function private.child_group(p_child_id uuid)
returns uuid
language sql
stable
set search_path = ''
as $$
  select c.group_id from public.profiles c where c.id = p_child_id and c.kind = 'child';
$$;

-- An adult who may manage this child (a current member of her group); otherwise "not found".
create function private.require_guardian(p_actor uuid, p_child_id uuid)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_group uuid := private.child_group(p_child_id);
begin
  if v_group is null or not private.is_member(v_group, p_actor) then
    raise exception 'keepup:child_not_found' using errcode = 'P0002';
  end if;
  return v_group;
end;
$$;

create function private.create_child_impl(
  p_actor uuid, p_group_id uuid, p_name text, p_avatar_emoji text, p_avatar_color text, p_guardian_confirmed boolean)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  perform private.require_admin(p_group_id, p_actor);
  if not coalesce(p_guardian_confirmed, false) then
    raise exception 'keepup:guardian_required' using errcode = 'P0001';
  end if;
  -- A nickname and an avatar only (privacy policy §9). The time zone column keeps its default; kid
  -- habits use the group's calendar.
  insert into public.profiles (id, display_name, kind, group_id, avatar_emoji, avatar_color)
  values (v_id, p_name, 'child', p_group_id, p_avatar_emoji, p_avatar_color);
  return v_id;
end;
$$;

create function private.update_child_impl(p_actor uuid, p_child_id uuid, p_name text, p_avatar_emoji text, p_avatar_color text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.require_guardian(p_actor, p_child_id);
  update public.profiles
     set display_name = coalesce(p_name, display_name),
         avatar_emoji = coalesce(p_avatar_emoji, avatar_emoji),
         avatar_color = coalesce(p_avatar_color, avatar_color)
   where id = p_child_id;
end;
$$;

create function private.create_child_habit_impl(
  p_actor uuid, p_child_id uuid, p_title text, p_emoji text, p_target_count int, p_period public.habit_period, p_starts_on date)
returns public.habits
language plpgsql
set search_path = ''
as $$
declare
  v_habit public.habits;
begin
  perform private.require_guardian(p_actor, p_child_id);
  insert into public.habits (owner_id, title, emoji, category, target_count, period, starts_on, created_by)
  values (p_child_id, p_title, p_emoji, null, p_target_count, p_period, p_starts_on, p_actor)
  returning * into v_habit;
  return v_habit;
end;
$$;

-- To another group where the same person is also an admin. Her own habits, check-ins and goals are
-- hers (owner/user/child ids), so they move by changing one column. Her part in the old group's
-- habits stays as history; required_members only counts children still in the habit's group.
create function private.move_child_impl(p_actor uuid, p_child_id uuid, p_to_group_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_from uuid := private.require_guardian(p_actor, p_child_id);
begin
  perform private.require_admin(v_from, p_actor);
  perform private.require_admin(p_to_group_id, p_actor);
  if v_from = p_to_group_id then
    raise exception 'keepup:same_group' using errcode = 'P0001';
  end if;
  update public.profiles set group_id = p_to_group_id where id = p_child_id;
end;
$$;

create function private.delete_child_impl(p_actor uuid, p_child_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.require_admin(private.require_guardian(p_actor, p_child_id), p_actor);
  delete from public.profiles where id = p_child_id;
end;
$$;

-- Treat goals (ideas/achievements-and-rewards.md §8). reached_at is set by a trigger in Task 5.
create table public.treat_goals (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (
    char_length(title) between 1 and 40
    and title = btrim(title, E' \t\n\r' || chr(160))
    and title !~ '^[[:space:]]*$'),
  emoji text not null check (char_length(emoji) between 1 and 16 and btrim(emoji) <> ''),
  target smallint not null check (target between 1 and 200),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  reached_at timestamptz,
  received_at timestamptz
);

create unique index treat_goals_one_active_idx on public.treat_goals (child_id) where received_at is null;

alter table public.treat_goals enable row level security;
create policy "treat_goals: read as guardian" on public.treat_goals
  for select to authenticated using (public.can_act_for_profile(child_id));
revoke all on public.treat_goals from anon, authenticated;
grant select on public.treat_goals to authenticated;

create function private.set_treat_goal_impl(p_actor uuid, p_child_id uuid, p_title text, p_emoji text, p_target int)
returns public.treat_goals
language plpgsql
set search_path = ''
as $$
declare
  v_row public.treat_goals;
begin
  perform private.require_guardian(p_actor, p_child_id);
  perform 1 from public.profiles c where c.id = p_child_id for update;
  if exists (select 1 from public.treat_goals g where g.child_id = p_child_id and g.received_at is null) then
    raise exception 'keepup:goal_exists' using errcode = 'P0001';
  end if;
  insert into public.treat_goals (child_id, title, emoji, target, created_by)
  values (p_child_id, p_title, p_emoji, p_target, p_actor)
  returning * into v_row;
  return v_row;
end;
$$;

create function private.cancel_treat_goal_impl(p_actor uuid, p_goal_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_goal public.treat_goals;
begin
  select g.* into v_goal from public.treat_goals g where g.id = p_goal_id and g.received_at is null;
  if not found or not private.can_act_for(p_actor, v_goal.child_id) then
    raise exception 'keepup:goal_not_found' using errcode = 'P0002';
  end if;
  delete from public.treat_goals where id = p_goal_id;
end;
$$;

create function private.mark_treat_received_impl(p_actor uuid, p_goal_id uuid)
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
  if v_goal.reached_at is null then
    raise exception 'keepup:goal_not_reached' using errcode = 'P0001';
  end if;
  update public.treat_goals set received_at = now() where id = p_goal_id;
end;
$$;

-- "Export first" before a child is deleted (ideas/kids-and-groups.md §3; privacy policy: any adult
-- of the child's group can export). Check-ins include those on group habits.
create function private.export_child_impl(p_actor uuid, p_child_id uuid)
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
                  'by_child', c.logged_by is null, 'created_at', c.created_at) order by c.created_at)
                from public.check_ins c join public.habits h on h.id = c.habit_id
               where c.user_id = p_child_id), '[]'::jsonb),
    'treat_goals', coalesce((select jsonb_agg(jsonb_build_object(
                  'title', g.title, 'emoji', g.emoji, 'target', g.target, 'created_at', g.created_at,
                  'reached_at', g.reached_at, 'received_at', g.received_at) order by g.created_at)
                from public.treat_goals g where g.child_id = p_child_id), '[]'::jsonb));
end;
$$;

create function private.my_children_impl(p_user uuid)
returns table (child_id uuid, name text, avatar_emoji text, avatar_color text, group_id uuid, group_name text, created_at timestamptz)
language sql
stable
set search_path = ''
as $$
  select c.id, c.display_name, c.avatar_emoji, c.avatar_color, g.id, g.name, c.created_at
    from public.profiles c
    join public.groups g on g.id = c.group_id
    join public.group_members m on m.group_id = g.id and m.user_id = p_user and m.left_at is null
   where c.kind = 'child'
   order by g.name, c.created_at;
$$;

-- Public API
create function public.create_child(p_group_id uuid, p_name text, p_avatar_emoji text, p_avatar_color text, p_guardian_confirmed boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return private.create_child_impl(auth.uid(), p_group_id, p_name, p_avatar_emoji, p_avatar_color, p_guardian_confirmed);
end;
$$;

create function public.update_child(p_child_id uuid, p_name text default null, p_avatar_emoji text default null, p_avatar_color text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  perform private.update_child_impl(auth.uid(), p_child_id, p_name, p_avatar_emoji, p_avatar_color);
end;
$$;

create function public.create_child_habit(
  p_child_id uuid, p_title text, p_emoji text, p_target_count smallint, p_period public.habit_period, p_starts_on date default null)
returns public.habits language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return private.create_child_habit_impl(auth.uid(), p_child_id, p_title, p_emoji, p_target_count, p_period, p_starts_on);
end;
$$;

create function public.move_child(p_child_id uuid, p_to_group_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  perform private.move_child_impl(auth.uid(), p_child_id, p_to_group_id);
end;
$$;

create function public.delete_child(p_child_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  perform private.delete_child_impl(auth.uid(), p_child_id);
end;
$$;

create function public.export_child(p_child_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return private.export_child_impl(auth.uid(), p_child_id);
end;
$$;

create function public.my_children()
returns table (child_id uuid, name text, avatar_emoji text, avatar_color text, group_id uuid, group_name text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select * from private.my_children_impl(auth.uid());
$$;

create function public.child_summaries(p_child_id uuid)
returns table (
  habit_id uuid, title text, category public.habit_category, emoji text, target_count smallint,
  period public.habit_period, starts_on date, created_at timestamptz, archived_at timestamptz,
  period_start date, not_started boolean, done_count int, checked_in_today boolean, frozen boolean,
  frozen_until date, days_left int, current_streak int, best_streak int,
  group_id uuid, group_name text, requires_approval boolean, pending_count int, group_done boolean,
  my_role text, members jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  perform private.require_guardian(auth.uid(), p_child_id);
  return query select * from private.subject_summaries(p_child_id, now());
end;
$$;

create function public.set_treat_goal(p_child_id uuid, p_title text, p_emoji text, p_target smallint)
returns public.treat_goals language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return private.set_treat_goal_impl(auth.uid(), p_child_id, p_title, p_emoji, p_target);
end;
$$;

create function public.cancel_treat_goal(p_goal_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  perform private.cancel_treat_goal_impl(auth.uid(), p_goal_id);
end;
$$;

create function public.mark_treat_received(p_goal_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  perform private.mark_treat_received_impl(auth.uid(), p_goal_id);
end;
$$;

revoke execute on function
  public.create_child(uuid, text, text, text, boolean), public.update_child(uuid, text, text, text),
  public.create_child_habit(uuid, text, text, smallint, public.habit_period, date),
  public.move_child(uuid, uuid), public.delete_child(uuid), public.export_child(uuid), public.my_children(),
  public.child_summaries(uuid), public.set_treat_goal(uuid, text, text, smallint),
  public.cancel_treat_goal(uuid), public.mark_treat_received(uuid)
  from public, anon;
grant execute on function
  public.create_child(uuid, text, text, text, boolean), public.update_child(uuid, text, text, text),
  public.create_child_habit(uuid, text, text, smallint, public.habit_period, date),
  public.move_child(uuid, uuid), public.delete_child(uuid), public.export_child(uuid), public.my_children(),
  public.child_summaries(uuid), public.set_treat_goal(uuid, text, text, smallint),
  public.cancel_treat_goal(uuid), public.mark_treat_received(uuid)
  to authenticated;
