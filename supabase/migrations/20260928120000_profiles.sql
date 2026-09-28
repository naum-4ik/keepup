-- A time zone is valid when Postgres has it in pg_timezone_names. That set includes IANA names
-- (e.g. 'Asia/Jerusalem') and some fixed abbreviations (e.g. 'EST'); it excludes raw UTC offsets
-- such as '+03', which is what this check is actually here to reject.
create or replace function public.is_valid_timezone(tz text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = tz);
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- The stored value itself (not just its trimmed form) must be 1-40 characters, with no
  -- leading/trailing whitespace and not whitespace-only. btrim's default trim set is ASCII space
  -- only, so it's given an explicit set here (space, tab, LF, CR, NBSP) to also catch a lone tab
  -- or an NBSP-only name.
  display_name text not null check (
    char_length(display_name) between 1 and 40
    and display_name = btrim(display_name, E' \t\n\r' || chr(160))
    and display_name !~ ('^[' || E' \t\n\r' || chr(160) || ']*$')
  ),
  timezone text not null default 'UTC' check (public.is_valid_timezone(timezone)),
  reminder_hour smallint not null default 20 check (reminder_hour between 0 and 23),
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Supabase grants everything by default; narrow it to exactly what the app needs.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, timezone, reminder_hour, onboarded_at) on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Must match the trim set used by public.profiles' display_name check constraint.
  ws constant text := E' \t\n\r' || chr(160);
  candidate text;
begin
  candidate := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name', ws), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name', ws), ''),
    nullif(btrim(split_part(coalesce(new.email, ''), '@', 1), ws), ''),
    'Guest'
  );
  -- Cutting to 40 characters can land on a space (e.g. when the 40th character of a long name
  -- happens to be a space); trim again after the cut so that never violates the check constraint.
  candidate := btrim(left(candidate, 40), ws);

  insert into public.profiles (id, display_name)
  values (new.id, candidate);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
