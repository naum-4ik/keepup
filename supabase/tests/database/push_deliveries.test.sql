-- supabase/tests/database/push_deliveries.test.sql
-- The push delivery log: own rows only, 30-day retention, and the rows the database writes when a push
-- can't be dispatched (empty Vault; daily summary due without a device).
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');
select tests.create_user('00000000-0000-0000-0000-0000000000e1', 'eve@example.com', '{"full_name":"Eve"}');

-- 1. Table and RLS: people read their own rows; only the service role writes.
insert into public.push_deliveries (user_id, kind, outcome, status, endpoint_host) values
  ('00000000-0000-0000-0000-0000000000a1', 'nudge', 'sent', 201, 'web.push.apple.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'nudge', 'gone', 410, 'fcm.googleapis.com');

select ok((select relrowsecurity from pg_class where oid = 'public.push_deliveries'::regclass), 'RLS is on');
select throws_ok($$insert into public.push_deliveries (user_id, kind, outcome) values ('00000000-0000-0000-0000-0000000000a1', 'nudge', 'delivered')$$,
  '23514', null, 'only sent / gone / failed / skipped');
select throws_ok($$insert into public.push_deliveries (user_id, kind, outcome, endpoint_host) values ('00000000-0000-0000-0000-0000000000a1', 'nudge', 'sent', 'web.push.apple.com/abc')$$,
  '23514', null, 'a host, never a full endpoint');

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1');
select is((select array_agg(kind || ':' || outcome) from public.push_deliveries), array['nudge:sent'], 'Anna sees only her own rows');
select throws_ok($$insert into public.push_deliveries (user_id, kind, outcome) values ('00000000-0000-0000-0000-0000000000a1', 'nudge', 'sent')$$,
  '42501', null, 'a signed-in user cannot write the log');
select throws_ok($$update public.push_deliveries set outcome = 'failed'$$, '42501', null, 'or change it');
select throws_ok($$delete from public.push_deliveries$$, '42501', null, 'or delete it');
reset role;
select is((select count(*)::int from public.push_deliveries where outcome in ('sent', 'gone')), 2, 'the log is unchanged');
select ok(not has_table_privilege('anon', 'public.push_deliveries', 'select'), 'anonymous visitors read nothing');
select ok(has_table_privilege('service_role', 'public.push_deliveries', 'insert'), 'the service role (send-push) inserts');

-- 2. Retention: the daily job deletes log rows after 30 days and still trims the feed at 60.
insert into public.push_deliveries (created_at, user_id, kind, outcome) values
  (now() - interval '31 days', '00000000-0000-0000-0000-0000000000a1', 'nudge', 'sent'),
  (now() - interval '29 days', '00000000-0000-0000-0000-0000000000a1', 'cheer', 'sent');
select ok((select command like '%public.notifications%60 days%' from cron.job where jobname = 'keepup-feed-retention'),
  'the retention job still trims the feed');
do $$ begin execute (select command from cron.job where jobname = 'keepup-feed-retention'); end $$;
select is((select count(*)::int from public.push_deliveries where kind = 'nudge' and created_at < now() - interval '30 days'), 0,
  'a 31-day-old row is deleted');
select is((select count(*)::int from public.push_deliveries where kind = 'cheer'), 1, 'a 29-day-old row stays');

-- 3. dispatch_push with an empty Vault: one 'skipped' row for the feed row, instead of silence.
delete from vault.secrets where name in ('send_push_url', 'send_push_secret');
create temp table t (k text primary key, v uuid) on commit drop;
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Family', 'family')).id;
insert into t select 'inv', (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), now())).id;
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000b1', (select token from public.group_invites where id = (select v from t where k = 'inv')), now());
insert into t select 'gym', (private.create_group_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'),
  'Gym', '🏋️', 'fitness', 1, 'day', null, false, '{}', now())).id;
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values
  ('00000000-0000-0000-0000-0000000000b1', 'https://push.example/dan', 'p', 'a');
select private.nudge_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'gym'), '00000000-0000-0000-0000-0000000000b1', 'you_got_this', now());
insert into t select 'nudge', (select id from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'nudge');
select ok((select push from public.notifications where id = (select v from t where k = 'nudge')), 'the nudge is flagged for push');
select results_eq(
  $$select notification_id, kind, outcome, reason, status, endpoint_host from public.push_deliveries
     where user_id = '00000000-0000-0000-0000-0000000000b1' and outcome = 'skipped'$$,
  $$values ((select v from t where k = 'nudge'), 'nudge'::text, 'skipped'::text, 'no_vault_url'::text, null::int, null::text)$$,
  'no Vault URL: one skipped row, pointing at the feed row');
delete from public.notifications where id = (select v from t where k = 'nudge');
select is((select count(*)::int from public.push_deliveries where reason = 'no_vault_url' and notification_id is null), 1,
  'the log row outlives its feed row (notification_id set null)');

-- 4. enqueue_reminders: due at 07:00 Rome, no device → one 'skipped' row per local day, no summary.
-- Anna and Eve have no device and a daily habit; Dan has one.
update public.profiles set timezone = 'Europe/Rome', reminder_hour = 7
 where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1');
create temp view skips as
  select pd.* from public.push_deliveries pd where pd.kind = 'daily_summary' and pd.reason = 'no_device';

select private.enqueue_reminders('2026-10-24 06:55+02');
select is((select count(*)::int from skips), 0, 'nothing logged before the reminder hour');
select private.enqueue_reminders('2026-10-24 07:05+02');
select results_eq($$select user_id, created_at, outcome from skips order by user_id$$,
  $$values ('00000000-0000-0000-0000-0000000000a1'::uuid, '2026-10-24 07:05+02'::timestamptz, 'skipped'::text),
           ('00000000-0000-0000-0000-0000000000e1'::uuid, '2026-10-24 07:05+02'::timestamptz, 'skipped'::text)$$,
  'due without a device: one skipped row each for Anna and Eve, none for Dan (he has a device)');
select private.enqueue_reminders('2026-10-24 07:20+02');
select private.enqueue_reminders('2026-10-24 07:50+02');
select is((select count(*)::int from skips), 2, 'later runs in the same hour add nothing (once per local day)');
select is((select count(*)::int from public.notifications where kind = 'daily_summary' and user_id <> '00000000-0000-0000-0000-0000000000b1'), 0,
  'and no summary is written for them');
select private.enqueue_reminders('2026-10-25 07:05+01');
select is((select count(*)::int from skips where created_at = '2026-10-25 07:05+01'), 2, 'the next day logs again');

update public.profiles set is_demo = true where id = '00000000-0000-0000-0000-0000000000e1';
select private.enqueue_reminders('2026-10-26 07:05+01');
select is((select array_agg(user_id) from skips where created_at = '2026-10-26 07:05+01'),
  array['00000000-0000-0000-0000-0000000000a1'::uuid], 'demo visitors (who can''t have devices) are not logged');

select * from finish();
rollback;
