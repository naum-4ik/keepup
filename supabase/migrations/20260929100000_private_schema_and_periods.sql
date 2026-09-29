-- Rule implementations live in `private`: PostgREST doesn't expose it, so clients can never call
-- them or pass their own "now". Public RPCs are thin SECURITY DEFINER wrappers (later migrations).
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Supabase grants EXECUTE on new public functions to anon by default. Stop that for everything
-- created from here on; each RPC grants EXECUTE to `authenticated` explicitly.
alter default privileges for role postgres in schema public revoke execute on functions from public, anon;

-- First day of the week for weekly habits: 0 = Sunday, 1 = Monday.
alter table public.profiles
  add column week_start smallint not null default 1 check (week_start in (0, 1));
grant update (week_start) on public.profiles to authenticated;

create type public.habit_period as enum ('day', 'week', 'month');

create function private.period_start(p_period public.habit_period, p_local_date date, p_week_start smallint default 1)
returns date
language sql
immutable
set search_path = ''
as $$
  select case p_period
    when 'day' then p_local_date
    when 'week' then p_local_date - ((extract(dow from p_local_date)::int - p_week_start + 7) % 7)
    when 'month' then date_trunc('month', p_local_date::timestamp)::date
  end;
$$;

-- Exclusive end: the first local date of the next period.
create function private.period_end(p_period public.habit_period, p_start date)
returns date
language sql
immutable
set search_path = ''
as $$
  select case p_period
    when 'day' then p_start + 1
    when 'week' then p_start + 7
    when 'month' then (p_start::timestamp + interval '1 month')::date
  end;
$$;

create function private.period_step(p_period public.habit_period)
returns interval
language sql
immutable
set search_path = ''
as $$
  select case p_period
    when 'day' then interval '1 day'
    when 'week' then interval '7 days'
    when 'month' then interval '1 month'
  end;
$$;

create function private.local_date(p_at timestamptz, p_tz text)
returns date
language sql
stable
set search_path = ''
as $$
  select (p_at at time zone p_tz)::date;
$$;

-- The instant a local date begins in a time zone (DST-aware).
create function private.local_midnight(p_date date, p_tz text)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (p_date::timestamp at time zone p_tz);
$$;
