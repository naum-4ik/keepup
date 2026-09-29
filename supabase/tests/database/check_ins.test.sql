begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

select tests.create_user('00000000-0000-0000-0000-0000000000a4', 'ci-a@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000b4', 'ci-b@example.com');
update public.profiles set timezone = 'Europe/Rome' where id = '00000000-0000-0000-0000-0000000000a4';

set local session_replication_role = replica;
insert into public.habits (id, owner_id, title, category, target_count, period, starts_on, created_at, archived_at) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a4', 'Read', 'mind', 1, 'day', '2026-09-01', '2026-09-01T08:00:00Z', null),
  ('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000a4', 'Water', 'health', 8, 'day', '2026-09-01', '2026-09-01T08:00:00Z', null),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000a4', 'Gym', 'fitness', 3, 'week', '2026-09-01', '2026-09-01T08:00:00Z', null),
  ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-0000000000a4', 'Old', 'home', 1, 'day', '2026-09-01', '2026-09-01T08:00:00Z', '2026-09-10T08:00:00Z'),
  ('00000000-0000-0000-0000-0000000000ff', '00000000-0000-0000-0000-0000000000a4', 'Paused', 'home', 1, 'day', '2026-09-01', '2026-09-01T08:00:00Z', null),
  ('00000000-0000-0000-0000-0000000000dd', '00000000-0000-0000-0000-0000000000a4', 'Fresh', 'home', 1, 'day', '2026-09-01', '2026-09-01T08:00:00Z', null),
  ('00000000-0000-0000-0000-0000000000de', '00000000-0000-0000-0000-0000000000a4', 'Api', 'home', 1, 'day', '2026-09-01', '2026-09-01T08:00:00Z', null),
  ('00000000-0000-0000-0000-0000000000ee', '00000000-0000-0000-0000-0000000000a4', 'Later', 'home', 1, 'day', '2026-10-10', '2026-10-05T08:00:00Z', null);
set local session_replication_role = origin;
insert into public.habit_freezes (habit_id, starts_on, ends_on)
values ('00000000-0000-0000-0000-0000000000ff', '2026-10-01', '2026-10-31');

-- Daily, once
select lives_ok($$select private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a4', '2026-10-05T08:00:00Z')$$,
  'a daily habit can be checked in');
select throws_ok($$select private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a4', '2026-10-05T09:00:00Z')$$,
  'P0001', 'keepup:target_reached', 'a once-a-day habit cannot be checked in twice the same day');
select lives_ok($$select private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a4', '2026-10-06T08:00:00Z')$$,
  'the next day is a new period');

-- Daily, 8 times
do $$
begin
  for i in 1..8 loop
    perform private.check_in_impl('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000a4', '2026-10-05T08:00:00Z');
  end loop;
end $$;
select throws_ok($$select private.check_in_impl('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000a4', '2026-10-05T10:00:00Z')$$,
  'P0001', 'keepup:target_reached', 'an 8-a-day habit stops at 8');

-- Weekly (Monday weeks by default): one per day
select lives_ok($$select private.check_in_impl('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000a4', '2026-10-05T08:00:00Z')$$,
  'a weekly habit can be checked in on Monday');
select throws_ok($$select private.check_in_impl('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000a4', '2026-10-05T18:00:00Z')$$,
  'P0001', 'keepup:already_checked_in_today', 'a weekly habit allows one check-in per day');
select lives_ok($$select private.check_in_impl('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000a4', '2026-10-06T08:00:00Z')$$,
  'and again on Tuesday');
select is((select count(*)::int from public.check_ins where habit_id = '00000000-0000-0000-0000-0000000000e3' and period_start = '2026-10-05'),
  2, 'both count for the week starting Monday 5 Oct');

-- Sunday weeks: a habit snapshots its own week_start at creation (C1), independent of the profile.
set local session_replication_role = replica;
insert into public.habits (id, owner_id, title, category, target_count, period, starts_on, created_at, archived_at, week_start) values
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000a4', 'Sunday Gym', 'fitness', 3, 'week', '2026-09-01', '2026-09-01T08:00:00Z', null, 0);
set local session_replication_role = origin;
select is((private.check_in_impl('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000a4', '2026-10-11T08:00:00Z')).period_start,
  '2026-10-11'::date, 'a habit created with week_start=0 starts a new week on Sunday 11 Oct');

update public.profiles set week_start = 0 where id = '00000000-0000-0000-0000-0000000000a4';
select is((select private.habit_period_start(h, '2026-10-07'::date) from public.habits h where h.id = '00000000-0000-0000-0000-0000000000e3'),
  '2026-10-05'::date, 'changing the profile''s week_start does not change an existing habit''s period key (still Monday-based)');
update public.profiles set week_start = 1 where id = '00000000-0000-0000-0000-0000000000a4';

-- Local dates
select is((private.check_in_impl('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000a4', '2026-10-25T23:30:00Z')).local_date,
  '2026-10-26'::date, '23:30 UTC on 25 Oct (after the DST change) is 26 Oct in Rome');

-- Refusals
select throws_ok($$select private.check_in_impl('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-0000000000a4', '2026-10-05T08:00:00Z')$$,
  'P0001', 'keepup:habit_archived', 'archived habits cannot be checked in');
select throws_ok($$select private.check_in_impl('00000000-0000-0000-0000-0000000000ff', '00000000-0000-0000-0000-0000000000a4', '2026-10-05T08:00:00Z')$$,
  'P0001', 'keepup:habit_frozen', 'paused habits cannot be checked in');
select throws_ok($$select private.check_in_impl('00000000-0000-0000-0000-0000000000ee', '00000000-0000-0000-0000-0000000000a4', '2026-10-05T08:00:00Z')$$,
  'P0001', 'keepup:habit_not_started', 'a habit cannot be checked in before its start date');
select throws_ok($$select private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b4', '2026-10-07T08:00:00Z')$$,
  'P0002', 'keepup:habit_not_found', 'a user cannot check in someone else''s habit');

-- Undo
select lives_ok(
  format($$select private.undo_check_in_impl(%L, '00000000-0000-0000-0000-0000000000a4', '2026-10-06T12:00:00Z')$$,
    (select id from public.check_ins where habit_id = '00000000-0000-0000-0000-0000000000e3' and local_date = '2026-10-06')),
  'a check-in in the open period can be undone');
select is((select count(*)::int from public.check_ins where habit_id = '00000000-0000-0000-0000-0000000000e3' and period_start = '2026-10-05'), 1,
  'the undone check-in is gone');
select throws_ok(
  format($$select private.undo_check_in_impl(%L, '00000000-0000-0000-0000-0000000000a4', '2026-10-06T12:00:00Z')$$,
    (select id from public.check_ins where habit_id = '00000000-0000-0000-0000-0000000000d1' and local_date = '2026-10-05')),
  'P0001', 'keepup:period_closed', 'a check-in from a closed period cannot be undone');
select throws_ok(
  format($$select private.undo_check_in_impl(%L, '00000000-0000-0000-0000-0000000000b4', '2026-10-06T12:00:00Z')$$,
    (select id from public.check_ins where habit_id = '00000000-0000-0000-0000-0000000000d1' and local_date = '2026-10-06')),
  'P0002', 'keepup:check_in_not_found', 'a user cannot undo someone else''s check-in');

-- Time-zone change keeps history
update public.profiles set timezone = 'America/New_York' where id = '00000000-0000-0000-0000-0000000000a4';
select is((select period_start from public.check_ins where habit_id = '00000000-0000-0000-0000-0000000000d1' and local_date = '2026-10-06'),
  '2026-10-06'::date, 'changing time zone never rewrites stored periods');
update public.profiles set timezone = 'Europe/Rome' where id = '00000000-0000-0000-0000-0000000000a4';

-- Start date locks after the first check-in
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a4');
select throws_ok(
  $$update public.habits set starts_on = ((now() at time zone 'Europe/Rome')::date + 5) where id = '00000000-0000-0000-0000-0000000000d1'$$,
  'P0001', 'keepup:start_locked', 'the start date cannot change after the first check-in');
select lives_ok(
  $$update public.habits set starts_on = ((now() at time zone 'Europe/Rome')::date + 5) where id = '00000000-0000-0000-0000-0000000000ee'$$,
  'the start date can change while there are no check-ins');
reset role;

-- Delete
select throws_ok($$select private.delete_habit_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a4')$$,
  'P0001', 'keepup:habit_has_history', 'a habit with check-ins cannot be deleted');
select lives_ok($$select private.delete_habit_impl('00000000-0000-0000-0000-0000000000dd', '00000000-0000-0000-0000-0000000000a4')$$,
  'a habit without check-ins can be deleted');
select is((select count(*)::int from public.habits where id = '00000000-0000-0000-0000-0000000000dd'), 0, 'and it is gone');

-- API surface
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a4');
select lives_ok($$select public.check_in('00000000-0000-0000-0000-0000000000de')$$, 'the owner checks in through the API');
select throws_ok(
  $$insert into public.check_ins (habit_id, user_id, local_date, period_start)
    values ('00000000-0000-0000-0000-0000000000de', '00000000-0000-0000-0000-0000000000a4', '2020-01-01', '2020-01-01')$$,
  '42501', null, 'check-ins cannot be inserted directly (no backdating)');
select throws_ok(
  $$select private.check_in_impl('00000000-0000-0000-0000-0000000000de', '00000000-0000-0000-0000-0000000000a4', '2020-01-01T00:00:00Z')$$,
  '42501', null, 'API users cannot pass their own time');

select ok((select count(*) from public.check_ins where habit_id = '00000000-0000-0000-0000-0000000000d1') > 0,
  'the owner can read their check-ins');
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b4');
select is((select count(*)::int from public.check_ins where habit_id = '00000000-0000-0000-0000-0000000000d1'), 0,
  'others cannot read someone else''s check-ins');
reset role;

reset role;
set local role anon;
select throws_ok($$select public.check_in('00000000-0000-0000-0000-0000000000de')$$, '42501', null, 'anonymous visitors cannot check in');
reset role;

select * from finish();
rollback;
