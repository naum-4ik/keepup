-- Delete account also removes the person's sign-in history (owner, 2026-10-07). Supabase Auth logs
-- sign-ups, sign-ins, sign-outs and password changes to auth.audit_log_entries with the user's id
-- (payload.actor_id) and email (payload.actor_username, or payload.traits.user_email for actions done
-- to them); deleting the login leaves those rows, so the email outlived the account. The body below is
-- 20261017100000's, plus the purge just before the login goes. Lock order unchanged: habits, then groups.

create or replace function private.delete_account_impl(p_user uuid, p_now timestamptz)
returns void
language plpgsql
set search_path = ''
as $$
declare
  r record;
  v_email text;
begin
  if not exists (select 1 from public.profiles where id = p_user and kind = 'adult') then
    raise exception 'keepup:not_found' using errcode = 'P0002';
  end if;
  -- Habits first, in one query in id order (the set lock_group_habits takes per group, plus the
  -- person's private habits), then the groups.
  perform 1 from public.habits h
   where (h.owner_id = p_user and h.group_id is null)
      or h.group_id in (select m.group_id from public.group_members m where m.user_id = p_user and m.left_at is null)
      or h.owner_id in (select c.id from public.profiles c
                         where c.kind = 'child'
                           and c.group_id in (select m.group_id from public.group_members m
                                               where m.user_id = p_user and m.left_at is null))
   order by h.id
     for update of h;
  perform 1 from public.groups g
    where g.id in (select m.group_id from public.group_members m where m.user_id = p_user and m.left_at is null)
    order by g.id for update;
  for r in select * from private.delete_account_plan(p_user) order by group_id loop
    if r.action = 'delete' then
      delete from public.groups where id = r.group_id;
    elsif r.action = 'handover' then
      update public.group_members set role = 'admin' where group_id = r.group_id and user_id = r.new_admin;
    end if;
  end loop;
  -- The sign-in history: by account id, or by email (payload is json; a null email matches nothing).
  select u.email into v_email from auth.users u where u.id = p_user;
  delete from auth.audit_log_entries a
   where a.payload->>'actor_id' = p_user::text
      or a.payload->>'actor_username' = v_email
      or a.payload->'traits'->>'user_email' = v_email;
  delete from auth.users where id = p_user;
end;
$$;
