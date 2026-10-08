-- Kid themes (ideas/kid-view-next.md §2): what grows in the kid view as stars come in. Each child has
-- one; null means the garden (the original). Any adult who manages the child can change it, ideally
-- choosing together with her. Only children have a theme.

alter table public.profiles
  add column kid_theme text check (kid_theme is null or kid_theme in ('garden', 'aquarium', 'space', 'dino', 'town')),
  add constraint profiles_kid_theme_child_check check (kid_theme is null or kind = 'child');

create function private.set_child_theme_impl(p_actor uuid, p_child_id uuid, p_theme text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.require_guardian(p_actor, p_child_id);
  update public.profiles set kid_theme = nullif(p_theme, 'garden') where id = p_child_id;
end;
$$;

create function public.set_child_theme(p_child_id uuid, p_theme text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  perform private.set_child_theme_impl(auth.uid(), p_child_id, p_theme);
end;
$$;

revoke execute on function public.set_child_theme(uuid, text) from public, anon;
grant execute on function public.set_child_theme(uuid, text) to authenticated;

-- my_children also returns the theme ('garden' when unset), for the kid page and the kid view. A new
-- return column means drop + create; the public wrapper depends on the impl.
drop function public.my_children();
drop function private.my_children_impl(uuid);

create function private.my_children_impl(p_user uuid)
returns table (
  child_id uuid, name text, avatar_emoji text, avatar_color text, group_id uuid, group_name text, created_at timestamptz,
  kid_theme text)
language sql
stable
set search_path = ''
as $$
  select c.id, c.display_name, c.avatar_emoji, c.avatar_color, g.id, g.name, c.created_at, coalesce(c.kid_theme, 'garden')
    from public.profiles c
    join public.groups g on g.id = c.group_id
    join public.group_members m on m.group_id = g.id and m.user_id = p_user and m.left_at is null
   where c.kind = 'child'
   order by g.name, c.created_at;
$$;

create function public.my_children()
returns table (
  child_id uuid, name text, avatar_emoji text, avatar_color text, group_id uuid, group_name text, created_at timestamptz,
  kid_theme text)
language sql stable security definer set search_path = '' as $$
  select * from private.my_children_impl(auth.uid());
$$;

revoke execute on function public.my_children() from public, anon;
grant execute on function public.my_children() to authenticated;
