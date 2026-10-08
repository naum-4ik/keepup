-- One-off copy of staging's data into production, step 3 of 3 (after the staging dump loaded).
-- Still inside the transaction: every copied table must hold exactly staging's row count, or this
-- raises and nothing is committed. Equal counts also prove no trigger fired during the load (a feed
-- row, XP event or new profile would add rows). The workflow commits (or rolls back) after this.
\set ON_ERROR_STOP on
set client_min_messages = notice;

do $$
declare
  r record;
  v_actual bigint;
  v_bad text := '';
begin
  -- All public tables, plus the auth tables that had rows (users, identities). Auth tables the dump
  -- held empty and the wipe didn't touch (production's own settings) aren't compared.
  for r in select * from pg_temp.copy_expected e
            where e.schema_name = 'public' or e.n > 0
            order by e.schema_name, e.table_name loop
    execute format('select count(*) from %I.%I', r.schema_name, r.table_name) into v_actual;
    raise notice 'copy check: %.%: staging %, production %', r.schema_name, r.table_name, r.n, v_actual;
    if v_actual <> r.n then
      v_bad := v_bad || format(' %s.%s (staging %s, production %s)', r.schema_name, r.table_name, r.n, v_actual);
    end if;
  end loop;
  if exists (select 1 from public.push_subscriptions) then
    v_bad := v_bad || ' public.push_subscriptions (must be empty)';
  end if;
  if exists (select 1 from auth.sessions) or exists (select 1 from auth.refresh_tokens) then
    v_bad := v_bad || ' auth.sessions/refresh_tokens (must be empty: everyone signs in again)';
  end if;
  if v_bad <> '' then
    raise exception 'copy: counts differ, nothing was changed:%', v_bad;
  end if;
  raise notice 'copy check: all counts match; % demo profiles came along (production''s hourly demo cleanup removes them once 24 h old)',
    (select count(*) from public.profiles where is_demo);
end $$;

set session_replication_role = origin;
