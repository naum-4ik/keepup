begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');
update public.profiles set timezone = 'UTC' where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1');

create temp table t (k text primary key, v uuid) on commit drop;
with h as (insert into public.habits (owner_id, title, category, target_count, period, starts_on)
           values ('00000000-0000-0000-0000-0000000000a1', 'Read', 'learning', 1, 'day', '2026-10-01') returning id)
insert into t select 'read', id from h;
with h as (insert into public.habits (owner_id, title, category, target_count, period, starts_on)
           values ('00000000-0000-0000-0000-0000000000a1', 'Laundry', 'home', 2, 'week', '2026-10-01') returning id)
insert into t select 'laundry', id from h;
with h as (insert into public.habits (owner_id, title, category, target_count, period, starts_on)
           values ('00000000-0000-0000-0000-0000000000b1', 'Dan reads', 'learning', 1, 'day', '2026-10-01') returning id)
insert into t select 'dan', id from h;

select private.check_in_impl((select v from t where k = 'read'), '00000000-0000-0000-0000-0000000000a1', '2026-10-01T09:00:00Z');
select private.check_in_impl((select v from t where k = 'read'), '00000000-0000-0000-0000-0000000000a1', '2026-10-03T09:00:00Z');
select private.check_in_impl((select v from t where k = 'laundry'), '00000000-0000-0000-0000-0000000000a1', '2026-10-02T09:00:00Z');
select private.check_in_impl((select v from t where k = 'dan'), '00000000-0000-0000-0000-0000000000b1', '2026-10-02T09:00:00Z');

select results_eq(
  $$select local_date::text, outcome, check_ins from private.calendar_cells_impl('00000000-0000-0000-0000-0000000000a1', '2026-09-28', '2026-10-06', '2026-10-05T12:00:00Z')
     where habit_id = (select v from t where k = 'read') order by 1$$,
  $$values ('2026-10-01', 'done', 1), ('2026-10-02', 'missed', 0), ('2026-10-03', 'done', 1), ('2026-10-04', 'missed', 0), ('2026-10-05', 'open', 0)$$,
  'a daily habit: done, missed and today open, from its start to today (not before, not after)');
select results_eq(
  $$select local_date::text, outcome, check_ins from private.calendar_cells_impl('00000000-0000-0000-0000-0000000000a1', '2026-09-28', '2026-10-06', '2026-10-05T12:00:00Z')
     where habit_id = (select v from t where k = 'laundry')$$,
  $$values ('2026-10-02', null::text, 1)$$,
  'a weekly habit shows only on the days it was checked in');
select is((select count(*)::int from private.calendar_cells_impl('00000000-0000-0000-0000-0000000000a1', '2026-09-28', '2026-10-06', '2026-10-05T12:00:00Z')
            where habit_id = (select v from t where k = 'dan')), 0, 'someone else''s habits are not included');

select lives_ok($$select * from private.calendar_cells_impl('00000000-0000-0000-0000-0000000000a1', '2026-09-01', '2026-10-31', '2026-10-05T12:00:00Z')$$,
  'a month plus the grid''s edges (61 days) is fine');
select throws_ok($$select * from private.calendar_cells_impl('00000000-0000-0000-0000-0000000000a1', '2026-08-01', '2026-10-31', '2026-10-05T12:00:00Z')$$,
  'P0001', 'keepup:bad_range', 'more than 62 days is refused');
select throws_ok($$select * from private.calendar_cells_impl('00000000-0000-0000-0000-0000000000a1', '2026-10-06', '2026-10-01', '2026-10-05T12:00:00Z')$$,
  'P0001', 'keepup:bad_range', 'a backwards range is refused');

-- Archived habits still count for the days they were active.
-- (habit_rules stamps archived_at with the real now(); triggers are off for this one pinned update.)
set local session_replication_role = replica;
update public.habits set archived_at = '2026-10-03T20:00:00Z' where id = (select v from t where k = 'read');
set local session_replication_role = origin;
select is((select max(local_date)::text from private.calendar_cells_impl('00000000-0000-0000-0000-0000000000a1', '2026-09-28', '2026-10-06', '2026-10-05T12:00:00Z')
            where habit_id = (select v from t where k = 'read') and outcome is not null), '2026-10-03',
  'an archived habit counts up to the day it was archived');

select ok(not has_function_privilege('anon', 'public.calendar_cells(date, date)', 'execute'), 'signed-out visitors cannot call calendar_cells');
select ok(has_function_privilege('authenticated', 'public.calendar_cells(date, date)', 'execute'), 'signed-in users can');

select * from finish();
rollback;
