-- Delete account (and demo cleanup, below) also removes the person's sign-in history (owner, 2026-10-07). Supabase Auth logs
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
  -- The sign-in history: by account id, or by email in any case (payload is json; a null email matches nothing).
  select u.email into v_email from auth.users u where u.id = p_user;
  delete from auth.audit_log_entries a
   where a.payload->>'actor_id' = p_user::text
      or lower(a.payload->>'actor_username') = lower(v_email)
      or lower(a.payload->'traits'->>'user_email') = lower(v_email);
  delete from auth.users where id = p_user;
end;
$$;

-- Demo cleanup too ("deleted automatically, with everything in them, after 24 hours"): the anonymous
-- logins it deletes leave their sign-in history (with the IP address on hosted). The body is
-- 20261018100000's, with the expiring logins collected once so both deletes use the same set.
create or replace function private.cleanup_demo(p_now timestamptz)
returns int language plpgsql set search_path = '' as $$
declare
  v_cutoff timestamptz := p_now - interval '24 hours';
  v_count int;
  v_logins uuid[];
begin
  -- "Expiring" = demo, older than 24h, not converted to a real login (updateUser with an email makes the
  -- user non-anonymous: never touched). A group goes if an expiring demo profile created it, or is still a
  -- member: groups.created_by is set null when its creator deletes their account, and groups are all-demo
  -- or all-real (member guard), so one expiring demo member proves the group is demo. But a group whose
  -- creator or any active member is a converted login is real now (the old bot is still a member): it stays.
  delete from public.groups g
   where exists (select 1 from public.profiles p
                  where p.is_demo and p.created_at < v_cutoff
                    and not exists (select 1 from auth.users u where u.id = p.id and not u.is_anonymous)
                    and (p.id = g.created_by
                         or exists (select 1 from public.group_members m
                                     where m.group_id = g.id and m.user_id = p.id and m.left_at is null)))
     and not exists (select 1 from auth.users u2 where u2.id = g.created_by and not u2.is_anonymous)
     and not exists (select 1 from public.group_members m2 join auth.users u3 on u3.id = m2.user_id
                      where m2.group_id = g.id and m2.left_at is null and not u3.is_anonymous);
  with gone as (
    delete from public.profiles p where p.is_demo and p.kind = 'adult' and p.created_at < v_cutoff
       and not exists (select 1 from auth.users u where u.id = p.id and not u.is_anonymous) returning p.id)
  select count(*) into v_count from gone;
  select coalesce(array_agg(u.id), '{}') into v_logins from auth.users u where u.is_anonymous and u.created_at < v_cutoff
    and not exists (select 1 from public.profiles p where p.id = u.id);
  delete from auth.audit_log_entries a where a.payload->>'actor_id' = any (v_logins::text[]);
  delete from auth.users u where u.id = any (v_logins);
  return v_count;
end; $$;
