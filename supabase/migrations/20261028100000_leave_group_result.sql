-- Leave group says what happened, so the app's toast can tell "you left" from "the group is deleted"
-- (and with how many children's profiles) without guessing from a read made before the leave.
-- Returns {"deleted": boolean, "children_deleted": int}. The body is copied from
-- 20261001100000_db_hardening.sql; only the result is new. The return type changes (void → jsonb),
-- so both functions are dropped and created again, with the grants of 20260930100000_groups.sql.

drop function public.leave_group(uuid, boolean);
drop function private.leave_group_impl(uuid, uuid, boolean, timestamptz);

create function private.leave_group_impl(p_user_id uuid, p_group_id uuid, p_confirm_children boolean, p_now timestamptz)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_children int;
begin
  if not private.is_member(p_group_id, p_user_id) then
    raise exception 'keepup:group_not_found' using errcode = 'P0002';
  end if;
  perform private.lock_group_habits(p_group_id);
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
    select count(*)::int into v_children from public.profiles c where c.kind = 'child' and c.group_id = p_group_id;
    delete from public.groups where id = p_group_id;
    return jsonb_build_object('deleted', true, 'children_deleted', v_children);
  end if;

  if private.is_admin(p_group_id, p_user_id) and not exists (
    select 1 from public.group_members m
     where m.group_id = p_group_id and m.left_at is null and m.role = 'admin' and m.user_id <> p_user_id) then
    raise exception 'keepup:last_admin' using errcode = 'P0001';
  end if;

  update public.group_members set left_at = p_now where group_id = p_group_id and user_id = p_user_id;
  return jsonb_build_object('deleted', false, 'children_deleted', 0);
end;
$$;

create function public.leave_group(p_group_id uuid, p_confirm_children boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return private.leave_group_impl(auth.uid(), p_group_id, p_confirm_children, now());
end;
$$;

revoke execute on function public.leave_group(uuid, boolean) from public, anon;
grant execute on function public.leave_group(uuid, boolean) to authenticated;
