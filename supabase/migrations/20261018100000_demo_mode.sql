-- Demo mode (M6 PR 2). "Try it" = Supabase anonymous sign-in + public.start_demo(). Every anonymous login
-- is a demo login; demo profiles (the visitor and the bot Alex) are deleted after 24h. Demo rows never mix
-- with real people: no invites, no shared groups, no push devices. See the demo ADR.

alter table public.profiles add column is_demo boolean not null default false;
-- No UPDATE grant on is_demo for API roles (profiles uses column grants), so the flag can't be cleared.

create function private.profiles_mark_demo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.is_demo := new.is_demo or exists (select 1 from auth.users u where u.id = new.id and u.is_anonymous);
  return new;
end; $$;
create trigger profiles_mark_demo before insert on public.profiles
  for each row execute function private.profiles_mark_demo();

create function private.demo_guard_invite()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.profiles p where p.id = new.created_by and p.is_demo) then
    raise exception 'keepup:demo' using errcode = '42501';
  end if;
  return new;
end; $$;
create trigger group_invites_demo_guard before insert on public.group_invites
  for each row execute function private.demo_guard_invite();

-- A group is all-demo or all-real. Checked on join and on rejoin (left_at cleared).
create function private.demo_guard_member()
returns trigger language plpgsql set search_path = '' as $$
declare v_demo boolean;
begin
  if new.left_at is not null then return new; end if;
  select p.is_demo into v_demo from public.profiles p where p.id = new.user_id;
  if exists (select 1 from public.group_members m join public.profiles p on p.id = m.user_id
              where m.group_id = new.group_id and m.user_id <> new.user_id and m.left_at is null
                and p.is_demo is distinct from v_demo) then
    raise exception 'keepup:demo' using errcode = '42501';
  end if;
  return new;
end; $$;
create trigger group_members_demo_guard before insert or update of left_at on public.group_members
  for each row execute function private.demo_guard_member();

create function private.demo_guard_push()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.profiles p where p.id = new.user_id and p.is_demo) then
    raise exception 'keepup:demo' using errcode = '42501';
  end if;
  return new;
end; $$;
create trigger push_subscriptions_demo_guard before insert on public.push_subscriptions
  for each row execute function private.demo_guard_push();

create function private.cleanup_demo(p_now timestamptz)
returns int language plpgsql set search_path = '' as $$
declare
  v_cutoff timestamptz := p_now - interval '24 hours';
  v_count int;
begin
  -- "Expiring" = demo, older than 24h, not converted to a real login (updateUser with an email makes the
  -- user non-anonymous: never touched). A group goes if an expiring demo profile created it, or is still a
  -- member: groups.created_by is set null when its creator deletes their account, and groups are all-demo
  -- or all-real (member guard), so one expiring demo member proves the group is demo.
  delete from public.groups g
   where exists (select 1 from public.profiles p
                  where p.is_demo and p.created_at < v_cutoff
                    and not exists (select 1 from auth.users u where u.id = p.id and not u.is_anonymous)
                    and (p.id = g.created_by
                         or exists (select 1 from public.group_members m
                                     where m.group_id = g.id and m.user_id = p.id and m.left_at is null)));
  with gone as (
    delete from public.profiles p where p.is_demo and p.kind = 'adult' and p.created_at < v_cutoff
       and not exists (select 1 from auth.users u where u.id = p.id and not u.is_anonymous) returning p.id)
  select count(*) into v_count from gone;
  delete from auth.users u where u.is_anonymous and u.created_at < v_cutoff
    and not exists (select 1 from public.profiles p where p.id = u.id);
  return v_count;
end; $$;

select cron.schedule('keepup-demo-cleanup', '41 * * * *', $$select private.cleanup_demo(now())$$);
