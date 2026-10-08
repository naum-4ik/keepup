-- One-off copy of staging's data into production, step 1 of 3 (after expected.sql opened the transaction).
-- Checks the two schemas match, then empties production's public tables and logins. Nothing commits
-- until verify.sql has compared every count; any error here rolls everything back.
\set ON_ERROR_STOP on
-- No triggers while wiping and loading: no feed rows, XP, pushes or profile creation.
set session_replication_role = replica;
-- The 15-minute cron jobs may hold locks briefly; give up rather than hang.
set lock_timeout = '30s';

do $$
declare
  v_only_staging text;
  v_only_production text;
begin
  -- Same migrations on both sides, so the data fits the tables (data only, never schema).
  select string_agg(version, ', ' order by version) into v_only_staging
    from (select version from pg_temp.copy_staging_migrations
          except select version from supabase_migrations.schema_migrations) s;
  select string_agg(version, ', ' order by version) into v_only_production
    from (select version from supabase_migrations.schema_migrations
          except select version from pg_temp.copy_staging_migrations) s;
  if v_only_staging is not null or v_only_production is not null then
    raise exception 'copy: migrations differ (only on staging: %; only on production: %)',
      coalesce(v_only_staging, '-'), coalesce(v_only_production, '-');
  end if;

  -- Every production public table is in the dump (push_subscriptions stays empty on purpose), and the
  -- dump has no table production lacks.
  select string_agg(t, ', ' order by t) into v_only_production
    from (select tablename::text t from pg_tables where schemaname = 'public' and tablename <> 'push_subscriptions'
          except select table_name from pg_temp.copy_expected where schema_name = 'public') s;
  select string_agg(t, ', ' order by t) into v_only_staging
    from (select table_name t from pg_temp.copy_expected where schema_name = 'public'
          except select tablename::text from pg_tables where schemaname = 'public') s;
  if v_only_staging is not null or v_only_production is not null then
    raise exception 'copy: public tables differ (only in the dump: %; only on production: %)',
      coalesce(v_only_staging, '-'), coalesce(v_only_production, '-');
  end if;

  raise notice 'copy: production before the copy: % profiles, % habits, % check-ins, % logins',
    (select count(*) from public.profiles), (select count(*) from public.habits),
    (select count(*) from public.check_ins), (select count(*) from auth.users);
end $$;

-- Logins: auth.users and every auth table hanging off it (identities, sessions, refresh tokens, MFA,
-- one-time tokens). Production's own audit log, flow state and settings tables stay.
truncate table auth.users cascade;

-- All public tables in one statement (push_subscriptions too: devices of logins that are gone). No
-- CASCADE: a table outside public pointing in here would be unexpected, so it fails instead.
do $$
begin
  execute (select 'truncate table ' || string_agg(format('%I.%I', schemaname, tablename), ', ' order by tablename)
             from pg_tables where schemaname = 'public');
end $$;
