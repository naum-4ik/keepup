-- supabase/tests/database/offline_check_ins.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');
update public.profiles set timezone = 'Europe/Rome'
 where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1');

create temp table t (k text primary key, v uuid) on commit drop;
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Family', 'family')).id;
update public.groups set timezone = 'Europe/Rome' where id = (select v from t where k = 'fam');
insert into t select 'inv', (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), now())).id;
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000b1', (select token from public.group_invites where id = (select v from t where k = 'inv')), now());
insert into t select 'mary', private.create_child_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), 'Mary', '🐼', 'peach', true);
insert into t select 'brush', (private.create_child_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'mary'), 'Brush teeth', '🪥', 1, 'day', null)).id;

-- Read and Walk (Anna), Stretch (Dan): private, daily, started 1 Oct 2026. Gym: the group's approval habit.
set local session_replication_role = replica;
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, requires_approval, created_at, created_by) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', null, 'Read', 'fitness', '📖', 1, 'day', '2026-10-01', 1, false, '2026-10-01 08:00+02', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a1', null, 'Walk', 'fitness', '🚶', 1, 'day', '2026-10-01', 1, false, '2026-10-01 08:00+02', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b1', null, 'Stretch', 'fitness', '🤸', 1, 'day', '2026-10-01', 1, false, '2026-10-01 08:00+02', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000d9', null, (select v from t where k = 'fam'), 'Gym', 'fitness', '🏋️', 1, 'day', '2026-10-01', 1, true, '2026-10-01 08:00+02', '00000000-0000-0000-0000-0000000000a1');
update public.group_members set joined_at = '2026-09-01' where group_id = (select v from t where k = 'fam');
set local session_replication_role = origin;

-- ideas/offline.md §"M4 tests"
select is((private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '2026-10-06 00:05+02', null, false,
            'c0000000-0000-0000-0000-000000000001', '2026-10-05 23:58+02')).local_date,
  '2026-10-05'::date, 'a tap at 23:58 that syncs at 00:05 counts for the day it was tapped');
select is((private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '2026-10-06 00:07+02', null, false,
            'c0000000-0000-0000-0000-000000000001', '2026-10-05 23:58+02')).id,
  (select id from public.check_ins where client_id = 'c0000000-0000-0000-0000-000000000001'), 'a resent tap returns the check-in it already made');
select is((select count(*)::int from public.check_ins where client_id = 'c0000000-0000-0000-0000-000000000001'), 1, 'and adds nothing');
select throws_ok($$select private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '2026-10-06 00:05+02', null, false,
                   'c0000000-0000-0000-0000-000000000002', '2026-10-06 00:15+02')$$,
  'P0001', 'keepup:tap_in_future', 'a tap from the future is refused');
select lives_ok($$select private.check_in_impl('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a1', '2026-10-06 00:05+02', null, false,
                  'c0000000-0000-0000-0000-000000000003', '2026-10-06 00:09+02')$$,
  'up to 5 minutes of clock skew is fine');
select ok((select private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '2026-10-06 00:05+02', null, false,
             'c0000000-0000-0000-0000-000000000004', '2026-10-03 00:04+02')) is null,
  'older than 3 days is dropped');
select is((select payload ->> 'tapped_on' from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'sync_dropped'),
  '2026-10-03', 'with a gentle note about the day it was tapped');
select throws_ok($$select private.check_in_impl('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b1', '2026-10-06 00:05+02', null, false,
                   'c0000000-0000-0000-0000-000000000001', '2026-10-06 00:01+02')$$,
  'P0002', 'keepup:check_in_not_found', 'a client id belongs to one check-in');

-- A late tap upgrades a settled missed day (decision 2026-09-29) and says the streak is back.
set local session_replication_role = replica;
insert into public.period_results (habit_id, period_start, outcome) values
  ('00000000-0000-0000-0000-0000000000d1', '2026-10-01', 'skipped'),
  ('00000000-0000-0000-0000-0000000000d1', '2026-10-02', 'done'),
  ('00000000-0000-0000-0000-0000000000d1', '2026-10-03', 'done');
set local session_replication_role = origin;
insert into public.period_results (habit_id, period_start, outcome) values ('00000000-0000-0000-0000-0000000000d1', '2026-10-04', 'missed');
select ok(exists (select 1 from public.notifications where kind = 'private_streak_ended' and habit_id = '00000000-0000-0000-0000-0000000000d1'),
  'setup: the streak-ended note went out');
select private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '2026-10-06 08:00+02', null, false,
  'c0000000-0000-0000-0000-000000000005', '2026-10-04 21:00+02');
select is((select outcome from public.period_results where habit_id = '00000000-0000-0000-0000-0000000000d1' and period_start = '2026-10-04'),
  'done', 'a late tap within 3 days turns a settled missed day into done');
select is((select current_streak from private.habit_streaks('00000000-0000-0000-0000-0000000000d1', '2026-10-06 08:00+02')), 4, 'and the streak is back');
select is((select count(*)::int from public.notifications where kind = 'streak_back' and habit_id = '00000000-0000-0000-0000-0000000000d1'),
  1, 'with a good-news note');
select private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '2026-10-06 08:01+02', null, false,
  'c0000000-0000-0000-0000-000000000005', '2026-10-04 21:00+02');
select ok((select count(*) from public.check_ins where client_id = 'c0000000-0000-0000-0000-000000000005') = 1
          and (select count(*) from public.notifications where kind = 'streak_back' and habit_id = '00000000-0000-0000-0000-0000000000d1') = 1,
  'resending the late tap changes nothing');

-- Review Focus 3: paused after the tap, archived before the sync.
set local session_replication_role = replica;
insert into public.habit_freezes (habit_id, user_id, starts_on, ends_on, created_by)
values ('00000000-0000-0000-0000-0000000000d2', null, '2026-10-06', null, '00000000-0000-0000-0000-0000000000a1');
set local session_replication_role = origin;
select lives_ok($$select private.check_in_impl('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a1', '2026-10-06 00:20+02', null, false,
                  'c0000000-0000-0000-0000-000000000006', '2026-10-05 20:00+02')$$,
  'a pause that starts after the tap does not refuse it');
update public.habits set archived_at = now() where id = '00000000-0000-0000-0000-0000000000d2';
select throws_ok($$select private.check_in_impl('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a1', '2026-10-06 00:20+02', null, false,
                   'c0000000-0000-0000-0000-000000000007', '2026-10-05 21:00+02')$$,
  'P0001', 'keepup:habit_archived', 'an archived habit refuses a queued tap (the app drops it)');

-- Quiet merge: Anna logged Mary online; Dan's offline tap for Mary arrives later.
select private.check_in_impl((select v from t where k = 'brush'), '00000000-0000-0000-0000-0000000000a1', now(), (select v from t where k = 'mary'));
select is((private.check_in_impl((select v from t where k = 'brush'), '00000000-0000-0000-0000-0000000000b1', now(), (select v from t where k = 'mary'), false,
            'c0000000-0000-0000-0000-000000000008', now())).logged_by,
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'a duplicate from another adult merges into the first check-in');
select is((select count(*)::int from public.check_ins where habit_id = (select v from t where k = 'brush')), 1, 'one check-in');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'already_logged'),
  1, 'Dan gets a quiet note');

-- Undo by client id, with the rules at sync time.
select private.check_in_impl('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b1', '2026-10-05 10:00+00', null, false,
  'c0000000-0000-0000-0000-000000000009', '2026-10-05 09:59+00');
select ok(private.undo_check_in_by_client_impl('c0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-0000000000b1', '2026-10-05 10:05+00'),
  'an offline undo in the same period works');
select ok(not private.undo_check_in_by_client_impl('c0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-0000000000b1', '2026-10-05 10:06+00'),
  'undoing again is a quiet no-op');
insert into t select 'gymci', (private.check_in_impl('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b1', '2026-10-05 10:00+00', null, false,
  'c0000000-0000-0000-0000-000000000010', '2026-10-05 10:00+00')).id;
select private.review_check_in_impl((select v from t where k = 'gymci'), '00000000-0000-0000-0000-0000000000a1', true, '2026-10-05 11:00+00');
select ok(not private.undo_check_in_by_client_impl('c0000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-0000000000b1', '2026-10-05 12:00+00'),
  'an offline undo after approval is refused');
select is((select payload ->> 'reason' from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'undo_dropped'),
  'approved', 'with a note saying why');

-- A late arrival on an approval habit gets its own 12h (decision 2026-09-29).
set local session_replication_role = replica;
insert into public.period_results (habit_id, period_start, outcome) values
  ('00000000-0000-0000-0000-0000000000d9', '2026-10-01', 'skipped'),
  ('00000000-0000-0000-0000-0000000000d9', '2026-10-02', 'done'),
  ('00000000-0000-0000-0000-0000000000d9', '2026-10-03', 'done'),
  ('00000000-0000-0000-0000-0000000000d9', '2026-10-04', 'done'),
  ('00000000-0000-0000-0000-0000000000d9', '2026-10-05', 'done');
insert into public.check_ins (habit_id, user_id, local_date, period_start, status, created_at, logged_by)
values ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000a1', '2026-10-06', '2026-10-06', 'approved', '2026-10-06 18:00+02', '00000000-0000-0000-0000-0000000000a1');
set local session_replication_role = origin;
select private.finalize_periods('2026-10-07 12:30+02');
select ok(exists (select 1 from public.notifications where kind = 'group_streak_ended' and habit_id = '00000000-0000-0000-0000-0000000000d9'),
  'setup: Gym''s 6 Oct closed as missed and the group heard its streak ended');
insert into t select 'late', (private.check_in_impl('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b1', '2026-10-07 13:00+02', null, false,
  'c0000000-0000-0000-0000-000000000011', '2026-10-06 20:00+02')).id;
select is((select status from public.check_ins where id = (select v from t where k = 'late')), 'pending', 'a late tap on an approval habit waits for a yes');
select is(private.check_in_deadline((select h from public.habits h where h.id = '00000000-0000-0000-0000-0000000000d9'),
                                    (select c from public.check_ins c where c.id = (select v from t where k = 'late'))),
  '2026-10-08 01:00+02'::timestamptz, 'it gets its own 12 hours from arrival');
select is(private.check_in_deadline((select h from public.habits h where h.id = '00000000-0000-0000-0000-0000000000d9'),
                                    (select c from public.check_ins c where c.habit_id = '00000000-0000-0000-0000-0000000000d9'
                                        and c.user_id = '00000000-0000-0000-0000-0000000000a1' and c.local_date = '2026-10-06')),
  '2026-10-07 12:00+02'::timestamptz, 'an on-time check-in keeps period end + 12h');
select is((select count(*)::int from private.pending_approvals_impl('00000000-0000-0000-0000-0000000000a1', '2026-10-07 23:00+02')
            where check_in_id = (select v from t where k = 'late')), 1, 'Anna can still approve it at 23:00');
select private.finalize_periods('2026-10-07 14:00+02');
select is((select status from public.check_ins where id = (select v from t where k = 'late')), 'pending', 'finalize does not expire it inside its 12 hours');
select private.review_check_in_impl((select v from t where k = 'late'), '00000000-0000-0000-0000-0000000000a1', true, '2026-10-07 23:00+02');
select is((select outcome from public.period_results where habit_id = '00000000-0000-0000-0000-0000000000d9' and period_start = '2026-10-06'),
  'done', 'approving it settles the day as done');
select is((select count(*)::int from public.notifications where kind = 'streak_back' and habit_id = '00000000-0000-0000-0000-0000000000d9'),
  2, 'and everyone hears the streak is back');

select ok(has_function_privilege('authenticated', 'public.check_in(uuid, uuid, timestamptz)', 'execute'), 'the app can send a client id and tap time');
select ok(has_function_privilege('authenticated', 'public.undo_check_in_by_client(uuid)', 'execute'), 'and undo by client id');
select ok(not has_function_privilege('anon', 'public.check_in_for(uuid, uuid, boolean, uuid, timestamptz)', 'execute'), 'anonymous visitors cannot');

-- Exactly one signature each, so old callers (one argument, positional or named) still resolve.
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'check_in'), 1, 'one public.check_in');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'check_in_for'), 1, 'one public.check_in_for');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok($$select public.check_in('00000000-0000-0000-0000-0000000000ee')$$,
  'P0002', 'keepup:habit_not_found', 'an old one-argument check_in call still resolves');
select throws_ok($$select public.check_in_for(p_habit_id => '00000000-0000-0000-0000-0000000000ee', p_child_id => '00000000-0000-0000-0000-0000000000ef')$$,
  'P0002', 'keepup:habit_not_found', 'an old named check_in_for call still resolves');
reset role;

select * from finish();
rollback;
