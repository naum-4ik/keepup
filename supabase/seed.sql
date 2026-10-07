-- Test helpers for pgTAP. seed.sql only runs on `supabase start` / `supabase db reset`; it must
-- never be pushed to a hosted project with `supabase db push --include-seed` or
-- `supabase seed --linked`. The `tests` schema is also not exposed through the API (PostgREST only
-- serves the schemas listed in config.toml's [api].schemas), so these helpers aren't callable from
-- outside the database even if seed.sql were mistakenly applied somewhere it shouldn't be.
create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

create or replace function tests.create_user(p_id uuid, p_email text, p_meta jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          p_email, p_meta, '{}'::jsonb, now(), now());
  return p_id;
end;
$$;

-- An anonymous (demo) login: same columns as create_user, no email, is_anonymous = true.
create or replace function tests.create_anonymous_user(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into auth.users (id, instance_id, aud, role, is_anonymous, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          true, '{}'::jsonb, '{}'::jsonb, now(), now());
  return p_id;
end;
$$;

-- Act as a signed-in user for the rest of the transaction. Undo with `reset role;`.
create or replace function tests.authenticate_as(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;
