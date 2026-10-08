-- A child with an empty or blank name (or none) gets a clean keepup:invalid_name (22023) instead of a raw
-- 23502 / 23514 from the profiles insert. Body copied from 20260930100200_children.sql; only the check is new.
-- The trim set matches profiles' display_name check constraint.
create or replace function private.create_child_impl(
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
  if coalesce(btrim(p_name, E' \t\n\r' || chr(160)), '') = '' then
    raise exception 'keepup:invalid_name' using errcode = '22023';
  end if;
  -- A nickname and an avatar only (privacy policy §9). The time zone column keeps its default; kid
  -- habits use the group's calendar.
  insert into public.profiles (id, display_name, kind, group_id, avatar_emoji, avatar_color)
  values (v_id, p_name, 'child', p_group_id, p_avatar_emoji, p_avatar_color);
  return v_id;
end;
$$;
