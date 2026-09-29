create type public.habit_category as enum
  ('health', 'fitness', 'mind', 'learning', 'people', 'home', 'money', 'break_habit');

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null,
  category public.habit_category not null,
  target_count smallint not null,
  period public.habit_period not null,
  starts_on date not null,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint habits_title_check check (
    char_length(title) between 1 and 60
    and title = btrim(title, E' \t\n\r' || chr(160))
    and title !~ '^[[:space:]]*$'
  ),
  constraint habits_target_check check (
    (period = 'day' and target_count between 1 and 50)
    or (period = 'week' and target_count between 1 and 7)
    or (period = 'month' and target_count between 1 and 31)
  )
);

create index habits_owner_active_idx on public.habits (owner_id) where archived_at is null;

alter table public.habits enable row level security;

create policy "habits: read own" on public.habits
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "habits: create own" on public.habits
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "habits: update own" on public.habits
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

revoke all on public.habits from anon, authenticated;
grant select on public.habits to authenticated;
grant insert (title, category, target_count, period, starts_on) on public.habits to authenticated;
grant update (title, category, starts_on, archived_at) on public.habits to authenticated;

-- Server-controlled fields. starts_on: defaults to the owner's local today, never in the past,
-- at most a year ahead. archived_at: set once, to now(); never changed or cleared.
-- (Task 4 extends this function: starts_on is locked after the first check-in.)
-- security definer: this fires on inserts/updates done as `authenticated`, which (per Task 1) has
-- no USAGE on schema `private` and so cannot resolve its call to private.local_date() as invoker.
-- The function owner (postgres, which owns schema `private`) keeps full privileges regardless of
-- the revoke. Reading public.profiles for new.owner_id here is safe: owner_id is neither
-- insertable nor updatable by `authenticated` (see the column grants above), so it is always
-- either the auth.uid() default (insert) or an unchanged existing value (update) by the time this
-- trigger runs -- never a value the caller could set to another user's id.
create function private.habit_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date;
begin
  select private.local_date(now(), p.timezone) into v_today
    from public.profiles p where p.id = new.owner_id;

  if tg_op = 'INSERT' then
    new.starts_on := coalesce(new.starts_on, v_today);
  end if;

  if tg_op = 'INSERT' or new.starts_on is distinct from old.starts_on then
    if new.starts_on < v_today then
      raise exception 'keepup:start_in_past' using errcode = 'P0001';
    end if;
    if new.starts_on > v_today + 365 then
      raise exception 'keepup:start_too_far' using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.archived_at is distinct from old.archived_at then
    new.archived_at := coalesce(old.archived_at, now());
  end if;
  return new;
end;
$$;

create trigger habits_rules
  before insert or update on public.habits
  for each row execute function private.habit_rules();

-- The owner's calendar, so rule code never passes time zones or week starts around by hand.
create function private.habit_today(p_habit public.habits, p_now timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select private.local_date(p_now, p.timezone) from public.profiles p where p.id = p_habit.owner_id;
$$;

create function private.habit_period_start(p_habit public.habits, p_local_date date)
returns date
language sql
stable
set search_path = ''
as $$
  select private.period_start(p_habit.period, p_local_date, p.week_start)
    from public.profiles p where p.id = p_habit.owner_id;
$$;

create function private.first_period_start(p_habit public.habits)
returns date
language sql
stable
set search_path = ''
as $$
  select private.habit_period_start(p_habit, p_habit.starts_on);
$$;
