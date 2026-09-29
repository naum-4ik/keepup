-- Onboarding v2: what Keepup is for (optional, null = not answered = me), and when the user
-- accepted the terms (by finishing onboarding step 1).
alter table public.profiles
  add column purpose text check (purpose in ('me', 'family', 'friends')),
  add column terms_accepted_at timestamptz;

-- purpose is the user's to change. terms_accepted_at gets no column grant: clients can't write it.
grant update (purpose) on public.profiles to authenticated;

-- terms_accepted_at is server-owned, like onboarded_at: it is set to the database's now() the first
-- time onboarded_at goes from null to set, and is pinned to its old value on every other update.
-- The condition reads old/new onboarded_at only, so it holds whichever trigger fires first.
create or replace function public.protect_terms_accepted_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.onboarded_at is null and new.onboarded_at is not null then
    new.terms_accepted_at := coalesce(old.terms_accepted_at, now());
  else
    new.terms_accepted_at := old.terms_accepted_at;
  end if;
  return new;
end;
$$;

revoke execute on function public.protect_terms_accepted_at() from public, anon;
grant execute on function public.protect_terms_accepted_at() to authenticated;

create trigger terms_accepted_at_server_set
  before update on public.profiles
  for each row execute function public.protect_terms_accepted_at();
