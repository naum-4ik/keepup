create table public.habit_freezes (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  starts_on date not null,
  ends_on date,
  created_at timestamptz not null default now(),
  constraint habit_freezes_range_check check (ends_on is null or ends_on >= starts_on)
);

create index habit_freezes_habit_idx on public.habit_freezes (habit_id);

alter table public.habit_freezes enable row level security;
create policy "habit_freezes: read own" on public.habit_freezes
  for select to authenticated
  using (exists (select 1 from public.habits h where h.id = habit_id and h.owner_id = (select auth.uid())));
revoke all on public.habit_freezes from anon, authenticated;
grant select on public.habit_freezes to authenticated;

-- True when any pause of the habit overlaps the local-date range [p_start, p_end).
create function private.is_frozen(p_habit_id uuid, p_start date, p_end date)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.habit_freezes f
     where f.habit_id = p_habit_id
       and f.starts_on < p_end
       and coalesce(f.ends_on, 'infinity'::date) >= p_start
  );
$$;

create function private.freeze_habit_impl(
  p_habit_id uuid, p_user_id uuid, p_starts_on date, p_ends_on date, p_now timestamptz)
returns public.habit_freezes
language plpgsql
set search_path = ''
as $$
declare
  v_habit public.habits;
  v_row public.habit_freezes;
begin
  select h.* into v_habit from public.habits h
   where h.id = p_habit_id and h.owner_id = p_user_id and h.archived_at is null
     for update;
  if not found then
    raise exception 'keepup:habit_not_found' using errcode = 'P0002';
  end if;

  if p_starts_on < private.habit_today(v_habit, p_now) then
    raise exception 'keepup:freeze_in_past' using errcode = 'P0001';
  end if;
  if p_ends_on is not null and p_ends_on < p_starts_on then
    raise exception 'keepup:freeze_range_invalid' using errcode = 'P0001';
  end if;
  if private.is_frozen(p_habit_id, p_starts_on, coalesce(p_ends_on + 1, 'infinity'::date)) then
    raise exception 'keepup:freeze_overlaps' using errcode = 'P0001';
  end if;

  insert into public.habit_freezes (habit_id, starts_on, ends_on)
  values (p_habit_id, p_starts_on, p_ends_on)
  returning * into v_row;
  return v_row;
end;
$$;

create function private.unfreeze_habit_impl(p_habit_id uuid, p_user_id uuid, p_now timestamptz)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_habit public.habits;
  v_today date;
begin
  select h.* into v_habit from public.habits h
   where h.id = p_habit_id and h.owner_id = p_user_id
     for update;
  if not found then
    raise exception 'keepup:habit_not_found' using errcode = 'P0002';
  end if;

  v_today := private.habit_today(v_habit, p_now);
  delete from public.habit_freezes where habit_id = p_habit_id and starts_on >= v_today;
  update public.habit_freezes set ends_on = v_today - 1
   where habit_id = p_habit_id and starts_on < v_today and (ends_on is null or ends_on >= v_today);
end;
$$;

create function public.freeze_habit(p_habit_id uuid, p_starts_on date, p_ends_on date default null)
returns public.habit_freezes
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'keepup:not_authenticated' using errcode = '42501';
  end if;
  return private.freeze_habit_impl(p_habit_id, auth.uid(), p_starts_on, p_ends_on, now());
end;
$$;

create function public.unfreeze_habit(p_habit_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'keepup:not_authenticated' using errcode = '42501';
  end if;
  perform private.unfreeze_habit_impl(p_habit_id, auth.uid(), now());
end;
$$;

revoke execute on function public.freeze_habit(uuid, date, date) from public, anon;
revoke execute on function public.unfreeze_habit(uuid) from public, anon;
grant execute on function public.freeze_habit(uuid, date, date) to authenticated;
grant execute on function public.unfreeze_habit(uuid) to authenticated;
