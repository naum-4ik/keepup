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
