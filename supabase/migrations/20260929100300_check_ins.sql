create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  local_date date not null,
  period_start date not null,
  -- M3 approval uses pending/rejected/expired; private habits are approved on insert.
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected', 'expired')),
  created_at timestamptz not null default now()
);

create index check_ins_habit_period_idx on public.check_ins (habit_id, period_start);
create index check_ins_habit_local_date_idx on public.check_ins (habit_id, local_date);

alter table public.check_ins enable row level security;
create policy "check_ins: read own" on public.check_ins
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.check_ins from anon, authenticated;
grant select on public.check_ins to authenticated;

-- Extend the habit rules: the start date locks after the first check-in.
-- security definer: the trigger runs for API users, who can't reach schema `private`.
create or replace function private.habit_rules()
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
    if tg_op = 'UPDATE' and exists (select 1 from public.check_ins c where c.habit_id = new.id) then
      raise exception 'keepup:start_locked' using errcode = 'P0001';
    end if;
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

create function private.check_in_impl(p_habit_id uuid, p_user_id uuid, p_now timestamptz)
returns public.check_ins
language plpgsql
set search_path = ''
as $$
declare
  v_habit public.habits;
  v_today date;
  v_start date;
  v_count int;
  v_row public.check_ins;
begin
  -- The row lock serialises concurrent check-ins (a double tap on a phone) for this habit.
  select h.* into v_habit from public.habits h
   where h.id = p_habit_id and h.owner_id = p_user_id
     for update;
  if not found then
    raise exception 'keepup:habit_not_found' using errcode = 'P0002';
  end if;
  if v_habit.archived_at is not null then
    raise exception 'keepup:habit_archived' using errcode = 'P0001';
  end if;

  v_today := private.habit_today(v_habit, p_now);
  if v_today < v_habit.starts_on then
    raise exception 'keepup:habit_not_started' using errcode = 'P0001';
  end if;
  v_start := private.habit_period_start(v_habit, v_today);

  if private.is_frozen(p_habit_id, v_start, private.period_end(v_habit.period, v_start)) then
    raise exception 'keepup:habit_frozen' using errcode = 'P0001';
  end if;

  select count(*) into v_count from public.check_ins c
   where c.habit_id = p_habit_id and c.user_id = p_user_id
     and c.period_start = v_start and c.status <> 'rejected';
  if v_count >= v_habit.target_count then
    raise exception 'keepup:target_reached' using errcode = 'P0001';
  end if;

  if v_habit.period <> 'day' and exists (
    select 1 from public.check_ins c
     where c.habit_id = p_habit_id and c.user_id = p_user_id
       and c.local_date = v_today and c.status <> 'rejected'
  ) then
    raise exception 'keepup:already_checked_in_today' using errcode = 'P0001';
  end if;

  insert into public.check_ins (habit_id, user_id, local_date, period_start, created_at)
  values (p_habit_id, p_user_id, v_today, v_start, p_now)
  returning * into v_row;
  return v_row;
end;
$$;

create function private.undo_check_in_impl(p_check_in_id uuid, p_user_id uuid, p_now timestamptz)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_check_in public.check_ins;
  v_habit public.habits;
begin
  select c.* into v_check_in from public.check_ins c
   where c.id = p_check_in_id and c.user_id = p_user_id;
  if not found then
    raise exception 'keepup:check_in_not_found' using errcode = 'P0002';
  end if;

  select h.* into v_habit from public.habits h where h.id = v_check_in.habit_id for update;
  if v_check_in.period_start <> private.habit_period_start(v_habit, private.habit_today(v_habit, p_now)) then
    raise exception 'keepup:period_closed' using errcode = 'P0001';
  end if;

  delete from public.check_ins where id = p_check_in_id;
end;
$$;

create function private.delete_habit_impl(p_habit_id uuid, p_user_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.habits h where h.id = p_habit_id and h.owner_id = p_user_id for update;
  if not found then
    raise exception 'keepup:habit_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.check_ins c where c.habit_id = p_habit_id) then
    raise exception 'keepup:habit_has_history' using errcode = 'P0001';
  end if;
  delete from public.habits where id = p_habit_id;
end;
$$;

create function public.check_in(p_habit_id uuid)
returns public.check_ins
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'keepup:not_authenticated' using errcode = '42501';
  end if;
  return private.check_in_impl(p_habit_id, auth.uid(), now());
end;
$$;

create function public.undo_check_in(p_check_in_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'keepup:not_authenticated' using errcode = '42501';
  end if;
  perform private.undo_check_in_impl(p_check_in_id, auth.uid(), now());
end;
$$;

create function public.delete_habit(p_habit_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'keepup:not_authenticated' using errcode = '42501';
  end if;
  perform private.delete_habit_impl(p_habit_id, auth.uid());
end;
$$;

revoke execute on function public.check_in(uuid) from public, anon;
revoke execute on function public.undo_check_in(uuid) from public, anon;
revoke execute on function public.delete_habit(uuid) from public, anon;
grant execute on function public.check_in(uuid) to authenticated;
grant execute on function public.undo_check_in(uuid) to authenticated;
grant execute on function public.delete_habit(uuid) to authenticated;
