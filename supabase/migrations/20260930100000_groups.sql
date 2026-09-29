-- M3 groups: child-ready profiles, groups, members, invite links, and the group RPCs.

-- 1. Profiles become child-ready. A child profile (Task 3) has no auth user, so profiles.id no longer
-- references auth.users; a trigger keeps "deleting the auth user deletes the profile" for adults.
alter table public.profiles drop constraint profiles_id_fkey;

create function private.delete_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.profiles where id = old.id;
  return old;
end;
$$;

create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute function private.delete_profile_for_auth_user();

-- 2. Groups. Time zone and week start are copied from the creator; group habits and kids' habits use
-- them (owner decision 2026-09-29).
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'other' check (kind in ('family', 'friends', 'couple', 'roommates', 'other')),
  timezone text not null check (public.is_valid_timezone(timezone)),
  week_start smallint not null check (week_start in (0, 1)),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint groups_name_check check (
    char_length(name) between 1 and 40
    and name = btrim(name, E' \t\n\r' || chr(160))
    and name !~ ('^[' || E' \t\n\r' || chr(160) || ']*$')
  )
);

alter table public.profiles
  add column kind text not null default 'adult' check (kind in ('adult', 'child')),
  add column group_id uuid references public.groups (id) on delete cascade,
  add column avatar_emoji text check (avatar_emoji is null or (char_length(avatar_emoji) between 1 and 16 and btrim(avatar_emoji) <> '')),
  add column avatar_color text check (avatar_color is null or avatar_color in ('peach', 'sage', 'sky', 'lilac', 'butter', 'rose')),
  -- A child belongs to exactly one group; an adult to none through this column (adults use group_members).
  add constraint profiles_child_group_check check ((kind = 'child') = (group_id is not null));

create index profiles_group_idx on public.profiles (group_id) where group_id is not null;
grant update (avatar_emoji, avatar_color) on public.profiles to authenticated;

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id) where left_at is null;

-- Only adults are members; children belong to a group through profiles.group_id.
create function private.group_member_is_adult()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select p.kind from public.profiles p where p.id = new.user_id) is distinct from 'adult' then
    raise exception 'keepup:not_an_adult' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger group_members_adult
  before insert or update of user_id on public.group_members
  for each row execute function private.group_member_is_adult();

create function private.new_invite_token()
returns text
language sql
volatile
set search_path = ''
as $$
  -- 18 random bytes → 24 URL-safe characters, no padding.
  select translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_');
$$;

create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default private.new_invite_token(),
  group_id uuid not null references public.groups (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index group_invites_group_idx on public.group_invites (group_id);

-- 3. Membership predicates.
create function private.is_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.group_members m
                  where m.group_id = p_group_id and m.user_id = p_user_id and m.left_at is null);
$$;

create function private.is_admin(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.group_members m
                  where m.group_id = p_group_id and m.user_id = p_user_id and m.left_at is null and m.role = 'admin');
$$;

-- Not a member → not found (don't reveal the group); a member but not an admin → not_admin.
create function private.require_admin(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not private.is_member(p_group_id, p_user_id) then
    raise exception 'keepup:group_not_found' using errcode = 'P0002';
  end if;
  if not private.is_admin(p_group_id, p_user_id) then
    raise exception 'keepup:not_admin' using errcode = 'P0001';
  end if;
end;
$$;

-- RLS helpers. Policies run as the API user, who can't reach schema `private`; these answer one
-- yes/no question about the caller and nothing else.
create function public.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_member(p_group_id, auth.uid());
$$;

create function public.is_group_admin(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin(p_group_id, auth.uid());
$$;

-- 4. RLS: members read their group and its member list; only admins read invite tokens. Writes go
-- through the RPCs below.
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;

create policy "groups: read as member" on public.groups
  for select to authenticated using (public.is_group_member(id));
create policy "group_members: read as member" on public.group_members
  for select to authenticated using (public.is_group_member(group_id));
create policy "group_invites: read as admin" on public.group_invites
  for select to authenticated using (public.is_group_admin(group_id));

revoke all on public.groups, public.group_members, public.group_invites from anon, authenticated;
grant select on public.groups, public.group_members, public.group_invites to authenticated;

-- 5. Rule implementations.
create function private.create_group_impl(p_user_id uuid, p_name text, p_kind text)
returns public.groups
language plpgsql
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_group public.groups;
begin
  select p.* into v_profile from public.profiles p where p.id = p_user_id and p.kind = 'adult';
  if not found then
    raise exception 'keepup:not_an_adult' using errcode = 'P0001';
  end if;
  insert into public.groups (name, kind, timezone, week_start, created_by)
  values (p_name, coalesce(p_kind, 'other'), v_profile.timezone, v_profile.week_start, p_user_id)
  returning * into v_group;
  insert into public.group_members (group_id, user_id, role) values (v_group.id, p_user_id, 'admin');
  return v_group;
end;
$$;

create function private.update_group_impl(
  p_user_id uuid, p_group_id uuid, p_name text, p_kind text, p_timezone text, p_week_start smallint)
returns public.groups
language plpgsql
set search_path = ''
as $$
declare
  v_group public.groups;
begin
  perform private.require_admin(p_group_id, p_user_id);
  update public.groups g
     set name = coalesce(p_name, g.name),
         kind = coalesce(p_kind, g.kind),
         timezone = coalesce(p_timezone, g.timezone),
         week_start = coalesce(p_week_start, g.week_start)
   where g.id = p_group_id
  returning * into v_group;
  return v_group;
end;
$$;

-- An active link is reused (spec: reusable until expiry or revocation), so "Copy link" twice
-- shares the same URL.
create function private.create_invite_impl(p_user_id uuid, p_group_id uuid, p_now timestamptz)
returns public.group_invites
language plpgsql
set search_path = ''
as $$
declare
  v_row public.group_invites;
begin
  perform private.require_admin(p_group_id, p_user_id);
  perform 1 from public.groups g where g.id = p_group_id for update;
  select i.* into v_row from public.group_invites i
   where i.group_id = p_group_id and i.revoked_at is null and i.expires_at > p_now
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

create function private.revoke_invites_impl(p_user_id uuid, p_group_id uuid, p_now timestamptz)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.require_admin(p_group_id, p_user_id);
  update public.group_invites set revoked_at = p_now
   where group_id = p_group_id and revoked_at is null and expires_at > p_now;
end;
$$;

-- Joining. Already a current member: nothing changes (an admin opening their own link stays admin).
-- A former member rejoins as a member with a new joined_at (spec: Data model → group_members).
create function private.accept_invite_impl(p_user_id uuid, p_token text, p_now timestamptz)
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

  insert into public.group_members (group_id, user_id, role, joined_at)
  values (v_invite.group_id, p_user_id, 'member', p_now)
  on conflict (group_id, user_id) do update
     set left_at = null, joined_at = excluded.joined_at, role = 'member'
   where public.group_members.left_at is not null;
  return v_invite.group_id;
end;
$$;

create function private.group_has_children(p_group_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.profiles c where c.group_id = p_group_id and c.kind = 'child');
$$;

-- Leaving. The last adult leaving deletes the group (spec: a group left with no members is deleted),
-- which deletes its children too, so that needs an explicit confirmation (ideas/kids-and-groups.md §3).
-- The last admin can't leave while others remain (spec: Groups).
create function private.leave_group_impl(p_user_id uuid, p_group_id uuid, p_confirm_children boolean, p_now timestamptz)
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

create function private.remove_member_impl(p_user_id uuid, p_group_id uuid, p_target_id uuid, p_now timestamptz)
returns void
language plpgsql
set search_path = ''
as $$
begin
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

create function private.set_member_role_impl(p_user_id uuid, p_group_id uuid, p_target_id uuid, p_role text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.require_admin(p_group_id, p_user_id);
  perform 1 from public.groups g where g.id = p_group_id for update;
  if not private.is_member(p_group_id, p_target_id) then
    raise exception 'keepup:member_not_found' using errcode = 'P0002';
  end if;
  if p_role = 'member' and private.is_admin(p_group_id, p_target_id) and not exists (
    select 1 from public.group_members m
     where m.group_id = p_group_id and m.left_at is null and m.role = 'admin' and m.user_id <> p_target_id) then
    raise exception 'keepup:last_admin' using errcode = 'P0001';
  end if;
  update public.group_members set role = p_role where group_id = p_group_id and user_id = p_target_id;
end;
$$;

create function private.delete_group_impl(p_user_id uuid, p_group_id uuid, p_confirm_children boolean)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.require_admin(p_group_id, p_user_id);
  if private.group_has_children(p_group_id) and not coalesce(p_confirm_children, false) then
    raise exception 'keepup:children_would_be_deleted' using errcode = 'P0001';
  end if;
  delete from public.groups where id = p_group_id;
end;
$$;

create function private.my_groups_impl(p_user_id uuid)
returns table (group_id uuid, name text, kind text, role text, member_count int, child_count int, joined_at timestamptz)
language sql
stable
set search_path = ''
as $$
  select g.id, g.name, g.kind, m.role,
         (select count(*)::int from public.group_members x where x.group_id = g.id and x.left_at is null),
         (select count(*)::int from public.profiles c where c.group_id = g.id and c.kind = 'child'),
         m.joined_at
    from public.group_members m join public.groups g on g.id = m.group_id
   where m.user_id = p_user_id and m.left_at is null
   order by m.joined_at, g.name;
$$;

-- Everything the group page shows. Names and avatars come from here (decision 0009), never from a
-- select on profiles. The invite token is included for admins only.
create function private.group_detail_impl(p_user_id uuid, p_group_id uuid, p_now timestamptz)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select case when not private.is_member(g.id, p_user_id) then null else jsonb_build_object(
    'id', g.id, 'name', g.name, 'kind', g.kind, 'timezone', g.timezone, 'week_start', g.week_start,
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

-- 6. Public API (thin wrappers).
create function public.create_group(p_name text, p_kind text default 'other')
returns public.groups language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return private.create_group_impl(auth.uid(), p_name, p_kind);
end;
$$;

create function public.update_group(
  p_group_id uuid, p_name text default null, p_kind text default null, p_timezone text default null, p_week_start smallint default null)
returns public.groups language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return private.update_group_impl(auth.uid(), p_group_id, p_name, p_kind, p_timezone, p_week_start);
end;
$$;

create function public.create_invite(p_group_id uuid)
returns public.group_invites language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return private.create_invite_impl(auth.uid(), p_group_id, now());
end;
$$;

create function public.revoke_invites(p_group_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  perform private.revoke_invites_impl(auth.uid(), p_group_id, now());
end;
$$;

-- Only what the landing page shows, only for a valid token. The inviter is shown by first name.
create function private.invite_preview_impl(p_token text, p_now timestamptz)
returns table (group_name text, group_kind text, inviter_name text, member_count int)
language sql
stable
set search_path = ''
as $$
  select g.name, g.kind, split_part(coalesce(p.display_name, ''), ' ', 1),
         (select count(*)::int from public.group_members m where m.group_id = g.id and m.left_at is null)
    from public.group_invites i
    join public.groups g on g.id = i.group_id
    left join public.profiles p on p.id = i.created_by
   where i.token = p_token and i.revoked_at is null and i.expires_at > p_now;
$$;

-- Callable by signed-out visitors (decision 0010).
create function public.invite_preview(p_token text)
returns table (group_name text, group_kind text, inviter_name text, member_count int)
language sql stable security definer set search_path = '' as $$
  select * from private.invite_preview_impl(p_token, now());
$$;

create function public.accept_invite(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return private.accept_invite_impl(auth.uid(), p_token, now());
end;
$$;

create function public.leave_group(p_group_id uuid, p_confirm_children boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  perform private.leave_group_impl(auth.uid(), p_group_id, p_confirm_children, now());
end;
$$;

create function public.remove_member(p_group_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  perform private.remove_member_impl(auth.uid(), p_group_id, p_user_id, now());
end;
$$;

create function public.set_member_role(p_group_id uuid, p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  if p_role not in ('admin', 'member') then raise exception 'keepup:invalid_role' using errcode = 'P0001'; end if;
  perform private.set_member_role_impl(auth.uid(), p_group_id, p_user_id, p_role);
end;
$$;

create function public.delete_group(p_group_id uuid, p_confirm_children boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  perform private.delete_group_impl(auth.uid(), p_group_id, p_confirm_children);
end;
$$;

create function public.my_groups()
returns table (group_id uuid, name text, kind text, role text, member_count int, child_count int, joined_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select * from private.my_groups_impl(auth.uid());
$$;

create function public.group_detail(p_group_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select private.group_detail_impl(auth.uid(), p_group_id, now());
$$;

revoke execute on function
  public.is_group_member(uuid), public.is_group_admin(uuid),
  public.create_group(text, text), public.update_group(uuid, text, text, text, smallint),
  public.create_invite(uuid), public.revoke_invites(uuid), public.accept_invite(text),
  public.leave_group(uuid, boolean), public.remove_member(uuid, uuid), public.set_member_role(uuid, uuid, text),
  public.delete_group(uuid, boolean), public.my_groups(), public.group_detail(uuid)
  from public, anon;
grant execute on function
  public.is_group_member(uuid), public.is_group_admin(uuid),
  public.create_group(text, text), public.update_group(uuid, text, text, text, smallint),
  public.create_invite(uuid), public.revoke_invites(uuid), public.accept_invite(text),
  public.leave_group(uuid, boolean), public.remove_member(uuid, uuid), public.set_member_role(uuid, uuid, text),
  public.delete_group(uuid, boolean), public.my_groups(), public.group_detail(uuid)
  to authenticated;
revoke execute on function public.invite_preview(text) from public;
grant execute on function public.invite_preview(text) to anon, authenticated;
