begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');
update public.profiles set timezone = 'UTC' where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1');

create temp table t (k text primary key, v uuid) on commit drop;
-- Anna's daily "Read" from 1 Oct: done 1–3 Oct, archived on 4 Oct (not done that day), restored on 8 Oct.
with h as (insert into public.habits (owner_id, title, category, target_count, period, starts_on)
           values ('00000000-0000-0000-0000-0000000000a1', 'Read', 'learning', 1, 'day', current_date) returning id)
insert into t select 'read', id from h;
set local session_replication_role = replica; -- the rules refuse a past start: backdate without triggers
update public.habits set starts_on = '2026-10-01', created_at = '2026-09-30T08:00:00Z' where id = (select v from t where k = 'read');
set local session_replication_role = origin;
select private.check_in_impl((select v from t where k = 'read'), '00000000-0000-0000-0000-0000000000a1', '2026-10-01T09:00:00Z');
select private.check_in_impl((select v from t where k = 'read'), '00000000-0000-0000-0000-0000000000a1', '2026-10-02T09:00:00Z');
select private.check_in_impl((select v from t where k = 'read'), '00000000-0000-0000-0000-0000000000a1', '2026-10-03T09:00:00Z');
select private.finalize_periods('2026-10-04T03:00:00Z');
-- habit_rules stamps archived_at with the real clock; pin it for the test.
set local session_replication_role = replica;
update public.habits set archived_at = '2026-10-04T18:00:00Z' where id = (select v from t where k = 'read');
set local session_replication_role = origin;

-- A plain update can't un-archive: habit_rules keeps it archived.
update public.habits set archived_at = null where id = (select v from t where k = 'read');
select ok((select archived_at is not null from public.habits where id = (select v from t where k = 'read')),
  'a direct update does not un-archive');

select throws_ok($$select private.restore_habit_impl('00000000-0000-0000-0000-0000000000b1', (select v from t where k = 'read'), '2026-10-08T09:00:00Z')$$,
  'P0002', 'keepup:habit_not_found', 'someone else cannot restore a private habit');
select lives_ok($$select private.restore_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'read'), '2026-10-08T09:00:00Z')$$,
  'the owner restores it');
select is((select archived_at from public.habits where id = (select v from t where k = 'read')), null, 'it is active again');
select results_eq($$select period_start::text, outcome from public.period_results where habit_id = (select v from t where k = 'read') order by 1$$,
  $$values ('2026-10-01', 'done'), ('2026-10-02', 'done'), ('2026-10-03', 'done'),
           ('2026-10-04', 'skipped'), ('2026-10-05', 'skipped'), ('2026-10-06', 'skipped'), ('2026-10-07', 'skipped')$$,
  'the archived days are skipped, never missed; history is kept');
select lives_ok($$select private.check_in_impl((select v from t where k = 'read'), '00000000-0000-0000-0000-0000000000a1', '2026-10-08T10:00:00Z')$$,
  'check-ins work again');
select results_eq($$select current_streak, best_streak from private.habit_streaks((select v from t where k = 'read'), '2026-10-08T12:00:00Z')$$,
  $$values (4, 4)$$, 'the streak carries on across the archived days');
select throws_ok($$select private.restore_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'read'), '2026-10-08T12:00:00Z')$$,
  'P0001', 'keepup:not_archived', 'an active habit has nothing to restore');

-- A done archive day stays done.
with h as (insert into public.habits (owner_id, title, category, target_count, period, starts_on)
           values ('00000000-0000-0000-0000-0000000000a1', 'Walk', 'fitness', 1, 'day', current_date) returning id)
insert into t select 'walk', id from h;
set local session_replication_role = replica; -- the rules refuse a past start: backdate without triggers
update public.habits set starts_on = '2026-10-01', created_at = '2026-09-30T08:00:00Z' where id = (select v from t where k = 'walk');
set local session_replication_role = origin;
select private.check_in_impl((select v from t where k = 'walk'), '00000000-0000-0000-0000-0000000000a1', '2026-10-01T09:00:00Z');
set local session_replication_role = replica;
update public.habits set archived_at = '2026-10-01T18:00:00Z' where id = (select v from t where k = 'walk');
set local session_replication_role = origin;
select private.restore_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'walk'), '2026-10-03T09:00:00Z');
select results_eq($$select period_start::text, outcome from public.period_results where habit_id = (select v from t where k = 'walk') order by 1$$,
  $$values ('2026-10-01', 'done'), ('2026-10-02', 'skipped')$$, 'the archive day keeps its check-in');

-- Finished habits use Start again instead.
with h as (insert into public.habits (owner_id, title, category, target_count, period, starts_on, ends_on)
           values ('00000000-0000-0000-0000-0000000000a1', 'Stretch', 'fitness', 1, 'day', current_date, null) returning id)
insert into t select 'stretch', id from h;
set local session_replication_role = replica; -- the rules refuse a past start: backdate without triggers
update public.habits set starts_on = '2026-10-01', ends_on = '2026-10-02', created_at = '2026-09-30T08:00:00Z' where id = (select v from t where k = 'stretch');
set local session_replication_role = origin;
select private.finish_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'stretch'), '2026-10-04T09:00:00Z');
select throws_ok($$select private.restore_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'stretch'), '2026-10-05T09:00:00Z')$$,
  'P0001', 'keepup:habit_finished', 'a finished habit is not restored');

-- Group habits: admins only.
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Family', 'family')).id;
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000b1',
  (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), now())).token, now());
insert into t select 'dinner', (private.create_group_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'),
  'Family dinner', '🍽️', 'people', 1, 'week', null, false, '{}', now())).id;
update public.habits set archived_at = now() where id = (select v from t where k = 'dinner');
select throws_ok($$select private.restore_habit_impl('00000000-0000-0000-0000-0000000000b1', (select v from t where k = 'dinner'), now())$$,
  'P0001', 'keepup:not_admin', 'a member cannot restore a group habit');
select lives_ok($$select private.restore_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'dinner'), now())$$,
  'an admin can');
select ok(not has_function_privilege('anon', 'public.restore_habit(uuid)', 'execute')
          and has_function_privilege('authenticated', 'public.restore_habit(uuid)', 'execute'),
  'signed-in users only');

select * from finish();
rollback;
