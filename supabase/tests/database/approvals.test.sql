begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');
select tests.create_user('00000000-0000-0000-0000-0000000000c1', 'carol@example.com', '{"full_name":"Carol"}');

set local session_replication_role = replica;
insert into public.groups (id, name, kind, timezone, week_start, created_by, created_at) values
  ('00000000-0000-0000-0000-0000000000f1', 'Gym buddies', 'friends', 'Asia/Jerusalem', 0, '00000000-0000-0000-0000-0000000000a1', '2026-09-01T08:00:00Z'),
  ('00000000-0000-0000-0000-0000000000f2', 'Solo', 'other', 'Asia/Jerusalem', 0, '00000000-0000-0000-0000-0000000000c1', '2026-09-01T08:00:00Z');
insert into public.group_members (group_id, user_id, role, joined_at) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'admin', '2026-09-01T08:00:00Z'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b1', 'member', '2026-09-01T08:00:00Z'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000c1', 'admin', '2026-09-01T08:00:00Z');
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, requires_approval, created_at, created_by) values
  ('00000000-0000-0000-0000-0000000000d1', null, '00000000-0000-0000-0000-0000000000f1', 'Gym', 'fitness', '🏋️', 1, 'day', '2026-09-01', 0, true, '2026-09-01T08:00:00Z', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000d2', null, '00000000-0000-0000-0000-0000000000f2', 'Solo gym', 'fitness', '🏋️', 1, 'day', '2026-09-01', 0, true, '2026-09-01T08:00:00Z', '00000000-0000-0000-0000-0000000000c1');
set local session_replication_role = origin;

-- Tue 6 Oct in Jerusalem (UTC+3). The day ends 21:00Z; the review window closes 09:00Z on 7 Oct.
select is((private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '2026-10-06T17:00:00Z')).status,
  'pending', 'on an approval habit, a check-in waits for a review');
select is((private.check_in_impl('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c1', '2026-10-06T17:00:00Z')).status,
  'approved', 'a one-adult group has nobody to approve, so it counts at once');
select throws_ok($$select private.review_check_in_impl((select id from public.check_ins where habit_id = '00000000-0000-0000-0000-0000000000d1'),
  '00000000-0000-0000-0000-0000000000a1', true, '2026-10-06T18:00:00Z')$$, 'P0001', 'keepup:own_check_in', 'nobody approves their own check-in');
select throws_ok($$select private.review_check_in_impl((select id from public.check_ins where habit_id = '00000000-0000-0000-0000-0000000000d1'),
  '00000000-0000-0000-0000-0000000000c1', true, '2026-10-06T18:00:00Z')$$, 'P0002', 'keepup:check_in_not_found', 'an outsider cannot review');
select is(private.period_outcome(h, '2026-10-06'), 'missed', 'a pending check-in does not count')
  from public.habits h where h.id = '00000000-0000-0000-0000-0000000000d1';

-- The morning after: still in grace; the streak doesn't drop
select ok(private.in_grace(h, '2026-10-06', '2026-10-07T06:00:00Z'), '09:00 local on Wednesday is still in the review window')
  from public.habits h where h.id = '00000000-0000-0000-0000-0000000000d1';
select is(private.finalize_periods('2026-10-07T06:00:00Z') >= 0, true, 'finalize runs during grace');
select is_empty($$select 1 from public.period_results where habit_id = '00000000-0000-0000-0000-0000000000d1' and period_start = '2026-10-06'$$,
  'a period in grace is not finalized yet');
select is((select outcome from private.habit_history('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', '2026-10-07T06:00:00Z', 2) where period_start = '2026-10-06'),
  'open', 'history shows the grace period as open, not missed');
select lives_ok($$select private.review_check_in_impl((select id from public.check_ins where habit_id = '00000000-0000-0000-0000-0000000000d1'),
  '00000000-0000-0000-0000-0000000000b1', true, '2026-10-07T06:30:00Z')$$, 'Dan approves the next morning');
select results_eq($$select status, reviewed_by from public.check_ins where habit_id = '00000000-0000-0000-0000-0000000000d1'$$,
  $$values ('approved'::text, '00000000-0000-0000-0000-0000000000b1'::uuid)$$, 'the review is recorded');
select throws_ok($$select private.review_check_in_impl((select id from public.check_ins where habit_id = '00000000-0000-0000-0000-0000000000d1'),
  '00000000-0000-0000-0000-0000000000b1', false, '2026-10-07T06:31:00Z')$$, 'P0001', 'keepup:already_reviewed', 'reviews are final; the first one wins');

-- A rejected check-in doesn't count, and the author may check in again
select lives_ok($$select private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', '2026-10-07T15:00:00Z')$$, 'Dan checks in Wednesday');
select lives_ok($$select private.review_check_in_impl((select id from public.check_ins where habit_id = '00000000-0000-0000-0000-0000000000d1' and user_id = '00000000-0000-0000-0000-0000000000b1'),
  '00000000-0000-0000-0000-0000000000a1', false, '2026-10-07T15:05:00Z')$$, 'Anna does not approve it');
select is((private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', '2026-10-07T16:00:00Z')).status,
  'pending', 'after a rejection the author may check in again');

-- Past the deadline: review refused; finalize expires pending and writes the outcome
select throws_ok($$select private.review_check_in_impl((select id from public.check_ins where habit_id = '00000000-0000-0000-0000-0000000000d1' and status = 'pending'),
  '00000000-0000-0000-0000-0000000000a1', true, '2026-10-08T09:00:00Z')$$, 'P0001', 'keepup:review_closed', 'the window closes 12h after the day ends');
select lives_ok($$select private.finalize_periods('2026-10-08T09:15:00Z')$$, 'finalize after the window');
select results_eq($$select (select status from public.check_ins where habit_id = '00000000-0000-0000-0000-0000000000d1' and local_date = '2026-10-07' and status in ('pending','expired')),
                          (select outcome from public.period_results where habit_id = '00000000-0000-0000-0000-0000000000d1' and period_start = '2026-10-07')$$,
  $$values ('expired'::text, 'missed'::text)$$, 'a pending check-in expires and the day is finalized without it');

select * from finish();
rollback;
