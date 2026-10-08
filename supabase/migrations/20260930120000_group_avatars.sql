-- Group avatars: an emoji on a pastel circle, like people (ideas/group-avatars.md). Admins set it;
-- until then the group shows its initial. The app offers a curated set; the database checks the shape,
-- the same as profiles.avatar_emoji / avatar_color.

alter table public.groups
  add column avatar_emoji text check (avatar_emoji is null or (char_length(avatar_emoji) between 1 and 16 and btrim(avatar_emoji) <> '')),
  add column avatar_color text check (avatar_color is null or avatar_color in ('peach', 'sage', 'sky', 'lilac', 'butter', 'rose'));

create function private.set_group_avatar_impl(p_user_id uuid, p_group_id uuid, p_emoji text, p_color text)
returns public.groups
language plpgsql
set search_path = ''
as $$
declare
  v_group public.groups;
begin
  perform private.require_admin(p_group_id, p_user_id);
  update public.groups g
     set avatar_emoji = nullif(btrim(p_emoji), ''),
         avatar_color = p_color
   where g.id = p_group_id
  returning * into v_group;
  return v_group;
end;
$$;

create function public.set_group_avatar(p_group_id uuid, p_emoji text, p_color text)
returns public.groups language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return private.set_group_avatar_impl(auth.uid(), p_group_id, p_emoji, p_color);
end;
$$;

revoke execute on function public.set_group_avatar(uuid, text, text) from public, anon;
grant execute on function public.set_group_avatar(uuid, text, text) to authenticated;

-- my_groups and group_detail also return the group's avatar (a new return column means drop + create;
-- the public wrappers depend on the impl, so they're recreated too).
drop function public.my_groups();
drop function private.my_groups_impl(uuid);

create function private.my_groups_impl(p_user_id uuid)
returns table (
  group_id uuid, name text, kind text, role text, member_count int, child_count int, joined_at timestamptz,
  avatar_emoji text, avatar_color text)
language sql
stable
set search_path = ''
as $$
  select g.id, g.name, g.kind, m.role,
         (select count(*)::int from public.group_members x where x.group_id = g.id and x.left_at is null),
         (select count(*)::int from public.profiles c where c.group_id = g.id and c.kind = 'child'),
         m.joined_at, g.avatar_emoji, g.avatar_color
    from public.group_members m join public.groups g on g.id = m.group_id
   where m.user_id = p_user_id and m.left_at is null
   order by m.joined_at, g.name;
$$;

create function public.my_groups()
returns table (
  group_id uuid, name text, kind text, role text, member_count int, child_count int, joined_at timestamptz,
  avatar_emoji text, avatar_color text)
language sql stable security definer set search_path = '' as $$
  select * from private.my_groups_impl(auth.uid());
$$;

revoke execute on function public.my_groups() from public, anon;
grant execute on function public.my_groups() to authenticated;

-- Same body as in 20260930100000_groups.sql, plus avatar_emoji / avatar_color (jsonb, so no drop).
create or replace function private.group_detail_impl(p_user_id uuid, p_group_id uuid, p_now timestamptz)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select case when not private.is_member(g.id, p_user_id) then null else jsonb_build_object(
    'id', g.id, 'name', g.name, 'kind', g.kind, 'timezone', g.timezone, 'week_start', g.week_start,
    'avatar_emoji', g.avatar_emoji, 'avatar_color', g.avatar_color,
    'my_role', (select m.role from public.group_members m where m.group_id = g.id and m.user_id = p_user_id),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'name', p.display_name, 'avatar_emoji', p.avatar_emoji, 'avatar_color', p.avatar_color,
               'role', m.role, 'joined_at', m.joined_at) order by m.joined_at)
        from public.group_members m join public.profiles p on p.id = m.user_id
       where m.group_id = g.id and m.left_at is null), '[]'::jsonb),
    'children', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'name', c.display_name, 'avatar_emoji', c.avatar_emoji, 'avatar_color', c.avatar_color)
             order by c.created_at)
        from public.profiles c where c.group_id = g.id and c.kind = 'child'), '[]'::jsonb),
    'invite', case when private.is_admin(g.id, p_user_id) then (
      select jsonb_build_object('token', i.token, 'expires_at', i.expires_at)
        from public.group_invites i
       where i.group_id = g.id and i.revoked_at is null and i.expires_at > p_now
       order by i.expires_at desc limit 1) end)
  end
    from public.groups g where g.id = p_group_id;
$$;
