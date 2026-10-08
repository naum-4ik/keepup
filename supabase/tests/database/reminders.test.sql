begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');
select tests.create_user('00000000-0000-0000-0000-0000000000e1', 'eve@example.com', '{"full_name":"Eve"}');
update public.profiles set timezone = 'Europe/Rome', reminder_hour = 7
 where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1');
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values
  ('00000000-0000-0000-0000-0000000000a1', 'https://push.example/anna', 'p', 'a'),
  ('00000000-0000-0000-0000-0000000000b1', 'https://push.example/dan', 'p', 'a');

-- Anna's habits, all started 1 Oct 2026 (weeks start Monday). Pinned dates: Sat 24 Oct 2026 (CEST,
-- UTC+2) and Sun 25 Oct, when Rome's clocks go back at 03:00 (CET, UTC+1).
set local session_replication_role = replica;
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, requires_approval, created_at, created_by)
select x.id::uuid, x.owner::uuid, null, x.title, 'fitness', '⭐', x.target, x.period::public.habit_period, x.starts::date, 1, false,
       '2026-10-01 08:00+02', x.owner::uuid
  from (values
    ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Read', 1, 'day', '2026-10-01'),
    ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a1', 'Water', 8, 'day', '2026-10-01'),
    ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000a1', 'Run', 3, 'week', '2026-10-01'),
    ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000a1', 'Stretch', 1, 'day', '2026-10-01'),
    ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-0000000000a1', 'Vitamins', 1, 'day', '2026-10-01'),
    ('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-0000000000a1', 'Yoga', 1, 'day', '2026-10-01'),
    ('00000000-0000-0000-0000-0000000000f7', '00000000-0000-0000-0000-0000000000a1', 'Swim', 1, 'day', '2026-11-01'),
    ('00000000-0000-0000-0000-0000000000f8', '00000000-0000-0000-0000-0000000000a1', 'Piano', 1, 'day', '2026-10-01'),
    ('00000000-0000-0000-0000-0000000000f9', '00000000-0000-0000-0000-0000000000a1', 'Chess', 1, 'day', '2026-10-01'),
    ('00000000-0000-0000-0000-0000000000fa', '00000000-0000-0000-0000-0000000000a1', 'Plan', 1, 'week', '2026-10-01'),
    ('00000000-0000-0000-0000-0000000000fb', '00000000-0000-0000-0000-0000000000b1', 'Walk', 1, 'day', '2026-10-01'),
    ('00000000-0000-0000-0000-0000000000fc', '00000000-0000-0000-0000-0000000000e1', 'Read', 1, 'day', '2026-10-01')
  ) as x(id, owner, title, target, period, starts);
insert into public.check_ins (habit_id, user_id, local_date, period_start, status, created_at, logged_by)
select '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a1', '2026-10-24', '2026-10-24', 'approved', '2026-10-24 06:00+02', '00000000-0000-0000-0000-0000000000a1'
  from generate_series(1, 5);
insert into public.check_ins (habit_id, user_id, local_date, period_start, status, created_at, logged_by) values
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000a1', '2026-10-20', '2026-10-19', 'approved', '2026-10-20 18:00+02', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000a1', '2026-10-24', '2026-10-24', 'approved', '2026-10-24 06:30+02', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000fb', '00000000-0000-0000-0000-0000000000b1', '2026-10-24', '2026-10-24', 'approved', '2026-10-24 06:30+02', '00000000-0000-0000-0000-0000000000b1');
insert into public.habit_freezes (habit_id, user_id, starts_on, ends_on, created_by)
values ('00000000-0000-0000-0000-0000000000f6', null, '2026-10-20', null, '00000000-0000-0000-0000-0000000000a1');
set local session_replication_role = origin;
insert into public.habit_user_settings (user_id, habit_id, muted, reminders, remind_at) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f5', false, true, '08:00'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f8', true, true, null),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f9', false, false, null);

create temp view summary as
  select n.* from public.notifications n where n.kind = 'daily_summary';

select private.enqueue_reminders('2026-10-24 06:55+02');
select is((select count(*)::int from summary where user_id = '00000000-0000-0000-0000-0000000000a1'), 0, 'nothing before the reminder hour');

select private.enqueue_reminders('2026-10-24 07:05+02');
select is((select payload -> 'todo' from summary where user_id = '00000000-0000-0000-0000-0000000000a1'),
  '[{"title": "Read", "done": 0, "target": 1}, {"title": "Water", "done": 5, "target": 8}]'::jsonb, 'still to do today, with progress');
select is((select payload -> 'at_risk' from summary where user_id = '00000000-0000-0000-0000-0000000000a1'),
  '[{"title": "Run", "done": 1, "target": 3, "period": "week", "days_left": 2}]'::jsonb, 'Run is at risk: 2 days left, 2 to go');
select ok((select payload::text not like '%Vitamins%' from summary where user_id = '00000000-0000-0000-0000-0000000000a1'),
  'a habit with its own time is left out of the summary');
select ok((select payload::text !~ '(Stretch|Yoga|Swim|Piano|Chess)' from summary where user_id = '00000000-0000-0000-0000-0000000000a1'),
  'nothing for done, paused, not-started, muted or reminders-off habits');
select ok((select payload::text not like '%Plan%' from summary where user_id = '00000000-0000-0000-0000-0000000000a1'),
  'a weekly habit with time to spare is not mentioned');
select ok((select push and category = 'reminders' from summary where user_id = '00000000-0000-0000-0000-0000000000a1'),
  'the summary is pushed under Reminders');

select private.enqueue_reminders('2026-10-24 07:20+02');
select is((select count(*)::int from summary where user_id = '00000000-0000-0000-0000-0000000000a1'), 1, 'one summary a day');
select is((select count(*)::int from summary where user_id = '00000000-0000-0000-0000-0000000000b1'), 0, 'no summary when nothing is left');
select is((select count(*)::int from summary where user_id = '00000000-0000-0000-0000-0000000000e1'), 0, 'no device, no summary');
select is((select count(*)::int from public.notifications where kind = 'habit_reminder'), 0, 'Vitamins waits for 08:00');

select private.enqueue_reminders('2026-10-24 08:05+02');
select is((select count(*)::int from public.notifications where kind = 'habit_reminder' and habit_id = '00000000-0000-0000-0000-0000000000f5'),
  1, 'Vitamins gets its own push at 08:00');

-- DST: on Sun 25 Oct, 06:05 CET is the instant 07:05 CEST was the day before.
select private.enqueue_reminders('2026-10-25 06:05+01');
select is((select count(*)::int from summary where user_id = '00000000-0000-0000-0000-0000000000a1' and dedupe_key like 'daily_summary:2026-10-25:%'),
  0, '06:05 on the day the clocks change is still too early');
select private.enqueue_reminders('2026-10-25 07:05+01');
select is((select count(*)::int from summary where user_id = '00000000-0000-0000-0000-0000000000a1' and dedupe_key like 'daily_summary:2026-10-25:%'),
  1, '07:00 stays 07:00 local on the day the clocks change');
select ok((select payload -> 'at_risk' @> '[{"title": "Plan", "days_left": 1}]'::jsonb from summary
            where user_id = '00000000-0000-0000-0000-0000000000a1' and dedupe_key like 'daily_summary:2026-10-25:%'),
  'on the week''s last day, Plan (1 to go) is at risk');

update public.profiles set timezone = 'Asia/Tokyo' where id = '00000000-0000-0000-0000-0000000000a1';
select private.enqueue_reminders('2026-10-26 07:05+09');
select is((select count(*)::int from summary where user_id = '00000000-0000-0000-0000-0000000000a1' and dedupe_key like 'daily_summary:2026-10-26:%'),
  1, 'after a move, the summary follows the new time zone');

select private.set_notification_pref_impl('00000000-0000-0000-0000-0000000000a1', 'reminders', false);
select private.enqueue_reminders('2026-10-27 07:05+09');
select ok((select not push from summary where user_id = '00000000-0000-0000-0000-0000000000a1' and dedupe_key like 'daily_summary:2026-10-27:%'),
  'Reminders off: the summary stays in the feed, without a push');

-- #3 Approval expiring: 2h before period end + 12h, once per check-in, never to the author.
create temp table t (k text primary key, v uuid) on commit drop;
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Family', 'family')).id;
update public.groups set timezone = 'Europe/Rome' where id = (select v from t where k = 'fam');
insert into t select 'inv', (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), now())).id;
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000b1', (select token from public.group_invites where id = (select v from t where k = 'inv')), now());
-- Joined before the seeded October days (joining stamps the real clock, which will pass them).
update public.group_members set joined_at = '2026-09-01' where group_id = (select v from t where k = 'fam');
set local session_replication_role = replica;
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, requires_approval, created_at, created_by)
values ('00000000-0000-0000-0000-0000000000d9', null, (select v from t where k = 'fam'), 'Gym', 'fitness', '🏋️', 1, 'day', '2026-10-01', 1, true,
        '2026-10-01 08:00+02', '00000000-0000-0000-0000-0000000000a1');
insert into public.check_ins (habit_id, user_id, local_date, period_start, status, created_at, logged_by)
values ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b1', '2026-10-24', '2026-10-24', 'pending', '2026-10-24 18:00+02', '00000000-0000-0000-0000-0000000000b1');
set local session_replication_role = origin;
-- The review window closes at 25 Oct 00:00 (CEST) + 12h = 10:00 UTC.
select private.enqueue_expiring_approvals('2026-10-25 07:00+00');
select is((select count(*)::int from public.notifications where kind = 'approval_expiring'), 0, 'not yet: more than 2 hours left');
select private.enqueue_expiring_approvals('2026-10-25 08:30+00');
select is((select count(*)::int from public.notifications where kind = 'approval_expiring' and user_id = '00000000-0000-0000-0000-0000000000a1'),
  1, 'Anna is asked, 2 hours before the window closes');
select is((select count(*)::int from public.notifications where kind = 'approval_expiring' and user_id = '00000000-0000-0000-0000-0000000000b1'),
  0, 'never the author');
select private.enqueue_expiring_approvals('2026-10-25 09:00+00');
select is((select count(*)::int from public.notifications where kind = 'approval_expiring'), 1, 'once per check-in');
select ok((select push and category = 'approvals' from public.notifications where kind = 'approval_expiring'), 'pushed under Approvals');

select is((select array_agg(jobname || ' ' || schedule order by jobname) from cron.job
            where jobname in ('keepup-reminders', 'keepup-expiring-approvals')),
  array['keepup-expiring-approvals */15 * * * *', 'keepup-reminders */15 * * * *'],
  'the scheduler runs every 15 minutes, as two jobs');

-- Wall-clock times the clocks skip or repeat (Rome: 29 Mar 2026 02:00 → 03:00; 25 Oct 03:00 → 02:00).
select is(private.local_instant('2026-03-29', '02:30', 'Europe/Rome'), '2026-03-29 03:30+02'::timestamptz,
  'a time the clocks skip lands an hour later');
select is(private.local_instant('2026-10-25', '02:30', 'Europe/Rome'), '2026-10-25 02:30+01'::timestamptz,
  'a time the clocks repeat is its second occurrence (after they go back)');

-- Own times are on the quarter hour, and each quarter has its tick.
select throws_ok($$select private.set_habit_reminder_impl('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', 'time', '07:10')$$,
  'P0001', 'keepup:invalid_time', 'a time off the quarter hour is refused');

-- A weekly habit with its own time (Anna now lives in Tokyo; the week starts Mon 26 Oct).
select private.set_habit_reminder_impl('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000fa', 'time', '09:00');
create temp view plan_reminders as
  select n.* from public.notifications n where n.kind = 'habit_reminder' and n.habit_id = '00000000-0000-0000-0000-0000000000fa';
select private.enqueue_reminders('2026-10-26 09:05+09');
select is(private.enqueue_reminders('2026-10-27 09:05+09'), 1, 'the count is the rows written');
select is(private.enqueue_reminders('2026-10-27 09:20+09'), 0, 'a row already written is not counted again');
select is((select count(*)::int from plan_reminders), 2, 'a weekly habit with its own time is reminded each day until done');
set local session_replication_role = replica;
insert into public.check_ins (habit_id, user_id, local_date, period_start, status, created_at, logged_by)
values ('00000000-0000-0000-0000-0000000000fa', '00000000-0000-0000-0000-0000000000a1', '2026-10-27', '2026-10-26', 'approved', '2026-10-27 12:00+09', '00000000-0000-0000-0000-0000000000a1');
set local session_replication_role = origin;
select private.enqueue_reminders('2026-10-28 09:05+09');
select private.enqueue_reminders('2026-10-29 09:05+09');
select is((select count(*)::int from plan_reminders), 2, 'and not after it is done');

select private.set_habit_reminder_impl('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', 'time', '23:45');
select private.enqueue_reminders('2026-10-30 23:30+09');
select is((select count(*)::int from public.notifications where kind = 'habit_reminder' and habit_id = '00000000-0000-0000-0000-0000000000f1'),
  0, '23:45 is not due at the 23:30 tick');
select private.enqueue_reminders('2026-10-30 23:45+09');
select is((select count(*)::int from public.notifications where kind = 'habit_reminder' and habit_id = '00000000-0000-0000-0000-0000000000f1'),
  1, '23:45 fires at the 23:45 tick, before the day ends');

-- Pause all: the summary is still written to the feed, without a push.
update public.profiles set muted_until = 'infinity' where id = '00000000-0000-0000-0000-0000000000b1';
select private.enqueue_reminders('2026-10-28 07:05+01');
select ok((select not push from summary where user_id = '00000000-0000-0000-0000-0000000000b1' and dedupe_key like 'daily_summary:2026-10-28:%'),
  'paused: the summary is in the feed, without a push');

-- A check-in reviewed before the job runs gets no "expiring" row. pgTAP runs in one session, so the
-- review comes before the call (same window) rather than between the job's select and its lock.
set local session_replication_role = replica;
with x as (
  insert into public.check_ins (habit_id, user_id, local_date, period_start, status, created_at, logged_by)
  values ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b1', '2026-10-25', '2026-10-25', 'pending', '2026-10-25 18:00+01', '00000000-0000-0000-0000-0000000000b1')
  returning id)
insert into t select 'ci2', id from x;
set local session_replication_role = origin;
select private.review_check_in_impl((select v from t where k = 'ci2'), '00000000-0000-0000-0000-0000000000a1', true, '2026-10-26 08:00+00');
select is(private.enqueue_expiring_approvals('2026-10-26 09:30+00'), 0, 'an approval reviewed in time writes nothing');
select is((select count(*)::int from public.notifications where kind = 'approval_expiring' and check_in_id = (select v from t where k = 'ci2')),
  0, 'no expiring row for a reviewed check-in');

-- A group habit's reminder is keyed to the group's day (Rome), not the person's (Tokyo).
select private.set_habit_reminder_impl('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d9', 'time', '07:00');
select private.enqueue_reminders('2026-10-27 07:05+09');
select ok(exists(select 1 from public.notifications where kind = 'habit_reminder' and habit_id = '00000000-0000-0000-0000-0000000000d9'
  and user_id = '00000000-0000-0000-0000-0000000000a1' and dedupe_key like '%:2026-10-26:%'), 'a group habit reminder uses the group''s day');

select * from finish();
rollback;
