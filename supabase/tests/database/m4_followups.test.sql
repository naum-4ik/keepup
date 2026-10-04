-- supabase/tests/database/m4_followups.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');

-- 1. Rotation in one call: the new subscription saved, the old row dropped, only while the caller has it.
select private.save_push_subscription_impl('00000000-0000-0000-0000-0000000000a1', 'https://fcm.googleapis.com/fcm/send/old', 'p-old', 'a-old', null);
select ok(private.rotate_push_subscription_impl('00000000-0000-0000-0000-0000000000a1', 'https://fcm.googleapis.com/fcm/send/old',
            'https://fcm.googleapis.com/fcm/send/new', 'p-new', 'a-new', 'ua'),
  'a rotation of Anna''s own device says it saved');
select is((select array_agg(endpoint || ' ' || p256dh) from public.push_subscriptions where user_id = '00000000-0000-0000-0000-0000000000a1'),
  array['https://fcm.googleapis.com/fcm/send/new p-new'], 'the new subscription replaces the old row');
select ok(not private.rotate_push_subscription_impl('00000000-0000-0000-0000-0000000000b1', 'https://fcm.googleapis.com/fcm/send/new',
            'https://fcm.googleapis.com/fcm/send/dan', 'p', 'a', null),
  'rotating someone else''s device is a no-op');
select ok(not exists (select 1 from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/dan')
          and exists (select 1 from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/new'),
  'nothing saved, Anna''s device untouched');
select ok(not private.rotate_push_subscription_impl('00000000-0000-0000-0000-0000000000a1', 'https://fcm.googleapis.com/fcm/send/removed',
            'https://fcm.googleapis.com/fcm/send/again', 'p', 'a', null),
  'a removed device stays removed');
select ok(private.rotate_push_subscription_impl('00000000-0000-0000-0000-0000000000a1', 'https://fcm.googleapis.com/fcm/send/new',
            'https://fcm.googleapis.com/fcm/send/new', 'p-renewed', 'a-renewed', null),
  'same endpoint with new keys says it saved');
select is((select array_agg(p256dh) from public.push_subscriptions where user_id = '00000000-0000-0000-0000-0000000000a1'),
  array['p-renewed'], 'one row, renewed');
select throws_ok($$select private.rotate_push_subscription_impl('00000000-0000-0000-0000-0000000000a1', 'https://fcm.googleapis.com/fcm/send/new',
                     'https://push.example/evil', 'p', 'a', null)$$,
  'P0001', 'keepup:invalid_subscription', 'a refused new subscription raises');
select ok(exists (select 1 from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/new'),
  'and the old row stays');

-- 2. The re-save on open: a phone shared without signing out moves to whoever signed in (same keys);
-- a device removed under Devices (from this phone or another one) isn't brought back.
select ok(private.refresh_push_subscription_impl('00000000-0000-0000-0000-0000000000b1', 'https://fcm.googleapis.com/fcm/send/new',
            'p-renewed', 'a-renewed', null),
  'Dan''s refresh on the phone Anna left signed in says it saved');
select is((select user_id from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/new'),
  '00000000-0000-0000-0000-0000000000b1'::uuid, 'the device follows Dan: Anna no longer gets pushes there');
select throws_ok($$select private.refresh_push_subscription_impl('00000000-0000-0000-0000-0000000000a1', 'https://fcm.googleapis.com/fcm/send/new',
                     'p-other', 'a-other', null)$$,
  'P0001', 'keepup:invalid_subscription', 'other keys can''t take it back');
delete from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/new';
select ok(not private.refresh_push_subscription_impl('00000000-0000-0000-0000-0000000000b1', 'https://fcm.googleapis.com/fcm/send/new',
            'p-renewed', 'a-renewed', null),
  'a removed device: refresh is a no-op');
select ok(not exists (select 1 from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/new'),
  'and it stays removed');

-- 3. "Approval expiring" right after "approval needed": a late arrival an hour before its window
-- closes gets no second push; an on-time check-in still gets its reminder 2 hours before the close.
create temp table t (k text primary key, v uuid) on commit drop;
update public.profiles set timezone = 'Europe/Rome'
 where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1');
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Family', 'family')).id;
update public.groups set timezone = 'Europe/Rome' where id = (select v from t where k = 'fam');
insert into t select 'inv', (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), now())).id;
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000b1', (select token from public.group_invites where id = (select v from t where k = 'inv')), now());
update public.group_members set joined_at = '2026-09-01' where group_id = (select v from t where k = 'fam');
set local session_replication_role = replica;
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, requires_approval, created_at, created_by)
values ('00000000-0000-0000-0000-0000000000d9', null, (select v from t where k = 'fam'), 'Gym', 'fitness', '🏋️', 1, 'day', '2026-10-01', 1, true,
        '2026-10-01 08:00+02', '00000000-0000-0000-0000-0000000000a1');
set local session_replication_role = origin;
-- Tapped on 14 Oct, arrives 15 Oct 11:00: its window still closes at 15 Oct 00:00 + 12h = 12:00.
insert into t select 'late', (private.check_in_impl('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b1', '2026-10-15 11:00+02',
  null, false, 'c0000000-0000-0000-0000-000000000001', '2026-10-14 20:00+02')).id;
select ok(exists (select 1 from public.notifications where kind = 'approval_needed' and check_in_id = (select v from t where k = 'late')
                   and user_id = '00000000-0000-0000-0000-0000000000a1'),
  'setup: Anna was asked to approve the late arrival');
select private.enqueue_expiring_approvals('2026-10-15 11:15+02');
select is((select count(*)::int from public.notifications where kind = 'approval_expiring' and check_in_id = (select v from t where k = 'late')),
  0, 'an hour before the close: no "expiring" right after "approval needed"');
-- On time: 15 Oct 18:00, its window closes 16 Oct 12:00; the reminder goes at 10:00.
insert into t select 'ontime', (private.check_in_impl('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b1', '2026-10-15 18:00+02',
  null, false, 'c0000000-0000-0000-0000-000000000002', null)).id;
select private.enqueue_expiring_approvals('2026-10-16 09:59+02');
select is((select count(*)::int from public.notifications where kind = 'approval_expiring' and check_in_id = (select v from t where k = 'ontime')),
  0, 'on time: nothing before 2 hours are left');
select private.enqueue_expiring_approvals('2026-10-16 10:00+02');
select is((select count(*)::int from public.notifications where kind = 'approval_expiring' and check_in_id = (select v from t where k = 'ontime')
            and user_id = '00000000-0000-0000-0000-0000000000a1'),
  1, 'on time: Anna still hears it is expiring, 2 hours before the close');

-- Just over 2 hours before the close (16 Oct tap, arrives 17 Oct 09:55; closes 12:00): the 10:00 tick
-- would be 5 minutes after "approval needed": nothing.
insert into t select 'edge', (private.check_in_impl('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b1', '2026-10-17 09:55+02',
  null, false, 'c0000000-0000-0000-0000-000000000003', '2026-10-16 20:00+02')).id;
select private.enqueue_expiring_approvals('2026-10-17 10:00+02');
select is((select count(*)::int from public.notifications where kind = 'approval_expiring' and check_in_id = (select v from t where k = 'edge')),
  0, 'arrived 2h05 before the close: no "expiring" 5 minutes after "approval needed"');
-- 3 hours before the close (17 Oct tap, arrives 18 Oct 09:00; closes 12:00): nothing at 10:00, the
-- reminder at 11:00, once "approval needed" is 2 hours old.
insert into t select 'early', (private.check_in_impl('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b1', '2026-10-18 09:00+02',
  null, false, 'c0000000-0000-0000-0000-000000000004', '2026-10-17 20:00+02')).id;
select private.enqueue_expiring_approvals('2026-10-18 10:00+02');
select is((select count(*)::int from public.notifications where kind = 'approval_expiring' and check_in_id = (select v from t where k = 'early')),
  0, 'arrived 3h before the close: nothing an hour later');
select private.enqueue_expiring_approvals('2026-10-18 11:00+02');
select is((select count(*)::int from public.notifications where kind = 'approval_expiring' and check_in_id = (select v from t where k = 'early')
            and user_id = '00000000-0000-0000-0000-0000000000a1'),
  1, 'and the reminder once "approval needed" is 2 hours old');

-- 4. A 23:45 reminder whose own tick didn't run is written by the 00:00 tick, once, for its own day.
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
values ('00000000-0000-0000-0000-0000000000a1', 'https://fcm.googleapis.com/fcm/send/anna-phone', 'p', 'a');
set local session_replication_role = replica;
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, requires_approval, created_at, created_by)
select x.id::uuid, '00000000-0000-0000-0000-0000000000a1', null, x.title, 'fitness', '⭐', 1, 'day', '2026-10-01', 1, false,
       '2026-10-01 08:00+02', '00000000-0000-0000-0000-0000000000a1'
  from (values ('00000000-0000-0000-0000-0000000000f1', 'Read'), ('00000000-0000-0000-0000-0000000000f2', 'Floss'),
               ('00000000-0000-0000-0000-0000000000f3', 'Stretch')) as x(id, title);
-- Floss was done on 14 Oct at 23:50, after its reminder time.
insert into public.check_ins (habit_id, user_id, local_date, period_start, status, created_at, logged_by)
values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a1', '2026-10-14', '2026-10-14', 'approved', '2026-10-14 23:50+02',
        '00000000-0000-0000-0000-0000000000a1');
set local session_replication_role = origin;
insert into public.habit_user_settings (user_id, habit_id, reminders, remind_at) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', true, '23:45'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f2', true, '23:45'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f3', true, '08:00');
create temp view reminder as select n.* from public.notifications n where n.kind = 'habit_reminder';

-- The 14 Oct 23:45 tick never ran.
select private.enqueue_reminders('2026-10-15 00:00+02');
select is((select array_agg(dedupe_key) from reminder where habit_id = '00000000-0000-0000-0000-0000000000f1'),
  array['habit_reminder:00000000-0000-0000-0000-0000000000f1:2026-10-14:00000000-0000-0000-0000-0000000000a1'],
  'the 00:00 tick writes yesterday''s 23:45 reminder, keyed by its own day');
select is((select count(*)::int from reminder where habit_id = '00000000-0000-0000-0000-0000000000f2'), 0,
  'not for a habit done after its reminder time: the day is judged as it was at 23:45');
select private.enqueue_reminders('2026-10-15 00:15+02');
select is((select count(*)::int from reminder where habit_id = '00000000-0000-0000-0000-0000000000f1'), 1, 'exactly once');
select private.enqueue_reminders('2026-10-15 08:00+02');
select is((select array_agg(dedupe_key) from reminder where habit_id = '00000000-0000-0000-0000-0000000000f3'),
  array['habit_reminder:00000000-0000-0000-0000-0000000000f3:2026-10-15:00000000-0000-0000-0000-0000000000a1'],
  'a normal time is unaffected');
select private.enqueue_reminders('2026-10-15 23:45+02');
select private.enqueue_reminders('2026-10-16 00:00+02');
select is((select array_agg(dedupe_key order by dedupe_key) from reminder where habit_id = '00000000-0000-0000-0000-0000000000f1'),
  array['habit_reminder:00000000-0000-0000-0000-0000000000f1:2026-10-14:00000000-0000-0000-0000-0000000000a1',
        'habit_reminder:00000000-0000-0000-0000-0000000000f1:2026-10-15:00000000-0000-0000-0000-0000000000a1'],
  'when the 23:45 tick runs, the 00:00 tick adds nothing');

select * from finish();
rollback;
