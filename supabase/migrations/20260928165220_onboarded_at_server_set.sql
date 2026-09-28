-- onboarded_at is a server-owned field: it marks the moment onboarding finished, and only the
-- server clock may set it. A client can ask to set it (the onboarding action sends its own
-- timestamp), but the stored value is always coalesce(old.onboarded_at, now()) -- i.e. it can be
-- set exactly once, only to the database's now(), and can never be cleared or backdated/forward-
-- dated afterwards.
create or replace function public.protect_onboarded_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.onboarded_at is distinct from old.onboarded_at then
    new.onboarded_at := coalesce(old.onboarded_at, now());
  end if;
  return new;
end;
$$;

create trigger onboarded_at_server_set
  before update on public.profiles
  for each row execute function public.protect_onboarded_at();

-- is_valid_timezone only needs to run as part of the profiles check constraint (evaluated with
-- the caller's own privileges, since it isn't security definer) and for ad-hoc use by postgres.
-- It never needs to be called directly over the API, so anonymous visitors and the PUBLIC
-- pseudo-role lose EXECUTE; authenticated keeps its own grant (already recorded separately from
-- PUBLIC by Supabase's default privileges) so profile updates keep working, and postgres is
-- unaffected as the owning superuser.
revoke execute on function public.is_valid_timezone(text) from anon, public;
grant execute on function public.is_valid_timezone(text) to authenticated, postgres;
