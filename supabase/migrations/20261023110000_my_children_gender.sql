-- my_children also returns the kid's gender (null = not set), for the kid form and the kid-addressed
-- copy. Profiles are read-own under RLS, so this is the only way a guardian reads it. A new return
-- column means drop + create; the public wrapper depends on the impl.
drop function public.my_children();
drop function private.my_children_impl(uuid);

create function private.my_children_impl(p_user uuid)
returns table (
  child_id uuid, name text, avatar_emoji text, avatar_color text, group_id uuid, group_name text, created_at timestamptz,
  kid_theme text, gender text)
language sql
stable
set search_path = ''
as $$
  select c.id, c.display_name, c.avatar_emoji, c.avatar_color, g.id, g.name, c.created_at, coalesce(c.kid_theme, 'garden'), c.gender
    from public.profiles c
    join public.groups g on g.id = c.group_id
    join public.group_members m on m.group_id = g.id and m.user_id = p_user and m.left_at is null
   where c.kind = 'child'
   order by g.name, c.created_at;
$$;

create function public.my_children()
returns table (
  child_id uuid, name text, avatar_emoji text, avatar_color text, group_id uuid, group_name text, created_at timestamptz,
  kid_theme text, gender text)
language sql stable security definer set search_path = '' as $$
  select * from private.my_children_impl(auth.uid());
$$;

revoke execute on function private.my_children_impl(uuid) from public, anon, authenticated;
revoke execute on function public.my_children() from public, anon;
grant execute on function public.my_children() to authenticated;
