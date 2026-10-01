-- supabase/tests/database/notification_prefs.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(57);

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');
select tests.create_user('00000000-0000-0000-0000-0000000000e1', 'eve@example.com', '{"full_name":"Eve"}');
update public.profiles set timezone = 'Asia/Tokyo' where id = '00000000-0000-0000-0000-0000000000a1';

create temp table t (k text primary key, v uuid) on commit drop;
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Family', 'family')).id;
insert into t select 'inv', (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), now())).id;
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000b1', (select token from public.group_invites where id = (select v from t where k = 'inv')), now());
insert into t select 'gym', (private.create_group_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'),
  'Gym', '🏋️', 'fitness', 1, 'day', null, false, '{}', now())).id;
insert into t select 'run', (private.create_group_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'),
  'Run', '🏃', 'fitness', 1, 'day', null, false, '{}', now())).id;
insert into t select 'walk', (private.create_group_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'),
  'Walk', '🚶', 'fitness', 1, 'day', null, false, '{}', now())).id;
insert into t select 'tidy', (private.create_group_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'),
  'Tidy', '🧹', 'fitness', 1, 'day', null, true, '{}', now())).id;

-- Precedence (spec: Mute controls): pause all → habit mute → per-habit reminders → category toggles.
select ok(private.push_allowed('00000000-0000-0000-0000-0000000000b1', 'nudge', (select v from t where k = 'gym'), (select v from t where k = 'fam'), '{}', now()),
  'a nudge pushes by default (a missing preference row means on)');
select ok(not private.push_allowed('00000000-0000-0000-0000-0000000000b1', 'cheer', (select v from t where k = 'gym'), (select v from t where k = 'fam'), '{}', now()),
  'feed-only kinds never push');
select is(private.push_category('check_in_rejected'), 'always', '"not approved" is not behind a category toggle');

select private.set_notification_pref_impl('00000000-0000-0000-0000-0000000000b1', 'nudges', false);
select ok(not private.push_allowed('00000000-0000-0000-0000-0000000000b1', 'nudge', (select v from t where k = 'gym'), (select v from t where k = 'fam'), '{}', now()),
  'turning Nudges off stops nudge pushes');
select ok(private.push_allowed('00000000-0000-0000-0000-0000000000b1', 'check_in_rejected', (select v from t where k = 'gym'), (select v from t where k = 'fam'), '{}', now()),
  '"always" events ignore category toggles');
select private.set_notification_pref_impl('00000000-0000-0000-0000-0000000000b1', 'nudges', true);
select ok(private.push_allowed('00000000-0000-0000-0000-0000000000b1', 'nudge', (select v from t where k = 'gym'), (select v from t where k = 'fam'), '{}', now()),
  'and back on');

select private.set_habit_mute_impl('00000000-0000-0000-0000-0000000000b1', (select v from t where k = 'gym'), true);
select ok(not private.push_allowed('00000000-0000-0000-0000-0000000000b1', 'nudge', (select v from t where k = 'gym'), (select v from t where k = 'fam'), '{}', now()),
  'a muted habit sends no pushes');
select ok(not private.push_allowed('00000000-0000-0000-0000-0000000000b1', 'check_in_rejected', (select v from t where k = 'gym'), (select v from t where k = 'fam'), '{}', now()),
  'not even "always" ones: habit mute comes before categories');
select ok(private.push_allowed('00000000-0000-0000-0000-0000000000b1', 'nudge', (select v from t where k = 'run'), (select v from t where k = 'fam'), '{}', now()),
  'other habits still push');
select private.set_habit_mute_impl('00000000-0000-0000-0000-0000000000b1', (select v from t where k = 'gym'), false);

select is(private.pause_notifications_impl('00000000-0000-0000-0000-0000000000b1', '8h', '2026-10-05 10:00:00+00'),
  '2026-10-05 18:00:00+00'::timestamptz, 'pause for 8 hours');
select is(private.pause_notifications_impl('00000000-0000-0000-0000-0000000000a1', 'tomorrow', '2026-10-05 10:00:00+00'),
  '2026-10-05 15:00:00+00'::timestamptz, '"until tomorrow" is the next midnight where Anna lives (Tokyo)');
select is(private.pause_notifications_impl('00000000-0000-0000-0000-0000000000b1', 'until_on', now()),
  'infinity'::timestamptz, '"until turned back on"');
select ok(not private.push_allowed('00000000-0000-0000-0000-0000000000b1', 'check_in_rejected', (select v from t where k = 'run'), (select v from t where k = 'fam'), '{}', now()),
  'pause all beats everything, "always" events included');
select private.pause_notifications_impl('00000000-0000-0000-0000-0000000000b1', 'resume', now());
select ok(private.push_allowed('00000000-0000-0000-0000-0000000000b1', 'nudge', (select v from t where k = 'run'), (select v from t where k = 'fam'), '{}', now()),
  'resume turns pushes back on');
select throws_ok($$select private.pause_notifications_impl('00000000-0000-0000-0000-0000000000b1', 'forever', now())$$,
  'P0001', 'keepup:invalid_choice', 'only the five pause choices');
select throws_ok($$select private.set_notification_pref_impl('00000000-0000-0000-0000-0000000000b1', 'marketing', false)$$,
  'P0001', 'keepup:invalid_category', 'only the six categories');
select throws_ok($$select private.set_habit_mute_impl('00000000-0000-0000-0000-0000000000e1', (select v from t where k = 'gym'), true)$$,
  'P0002', 'keepup:habit_not_found', 'an outsider cannot touch a group habit''s settings');

select private.set_habit_reminder_impl('00000000-0000-0000-0000-0000000000b1', (select v from t where k = 'gym'), 'time', '08:00');
select is((select remind_at from public.habit_user_settings where user_id = '00000000-0000-0000-0000-0000000000b1' and habit_id = (select v from t where k = 'gym')),
  '08:00'::time, 'Remind me at 08:00');
select throws_ok($$select private.set_habit_reminder_impl('00000000-0000-0000-0000-0000000000b1', (select v from t where k = 'gym'), 'time', null)$$,
  'P0001', 'keepup:invalid_choice', 'a time reminder needs a time');
select private.set_habit_reminder_impl('00000000-0000-0000-0000-0000000000b1', (select v from t where k = 'gym'), 'off', null);
select ok((select not reminders and remind_at is null from public.habit_user_settings
            where user_id = '00000000-0000-0000-0000-0000000000b1' and habit_id = (select v from t where k = 'gym')),
  '"No reminders" turns the habit''s reminders off and clears the time');

-- The flag on real rows, and the webhook (Vault secrets set only inside this rolled-back test).
select vault.create_secret('http://push.test/send-push', 'send_push_url');
select vault.create_secret('test-secret', 'send_push_secret');
-- Dan has a device (send-push is only called for people with one).
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
values ('00000000-0000-0000-0000-0000000000b1', 'https://push.example/dead', 'p', 'a');
select private.nudge_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'gym'), '00000000-0000-0000-0000-0000000000b1', 'you_got_this', now());
select is((select category from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'nudge'),
  'nudges', 'the row records its category');
select ok((select push from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'nudge'),
  'and that preferences allowed a push');
select is((select count(*)::int from net.http_request_queue where url = 'http://push.test/send-push'), 1, 'a push row calls send-push once');
select is((select headers ->> 'x-keepup-push-secret' from net.http_request_queue where url = 'http://push.test/send-push'),
  'test-secret', 'with the shared secret, never the service-role key');

select private.pause_notifications_impl('00000000-0000-0000-0000-0000000000a1', 'resume', now());
select private.nudge_impl('00000000-0000-0000-0000-0000000000b1', (select v from t where k = 'gym'), '00000000-0000-0000-0000-0000000000a1', 'you_got_this', now());
select ok((select push from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'nudge'
            and habit_id = (select v from t where k = 'gym')),
  'a push row for someone with no devices yet');
select is((select count(*)::int from net.http_request_queue where url = 'http://push.test/send-push'), 1, 'does not call send-push');

select private.pause_notifications_impl('00000000-0000-0000-0000-0000000000a1', 'until_on', now());
select private.nudge_impl('00000000-0000-0000-0000-0000000000b1', (select v from t where k = 'run'), '00000000-0000-0000-0000-0000000000a1', 'gentle_reminder', now());
select ok((select not push from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'nudge'
            and habit_id = (select v from t where k = 'run')),
  'paused: the nudge is in the feed without a push');
select is((select count(*)::int from net.http_request_queue where url = 'http://push.test/send-push'), 1, 'and send-push is not called');

-- Devices: one row per endpoint; it follows whoever signed in last.
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1');
select public.save_push_subscription('https://push.example/abc', 'p256-anna', 'auth-anna', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)');
reset role;
select is((select user_id from public.push_subscriptions where endpoint = 'https://push.example/abc'),
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'Anna saves this phone');
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select public.save_push_subscription('https://push.example/abc', 'p256-dan', 'auth-dan', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)');
reset role;
select is((select count(*)::int from public.push_subscriptions where endpoint = 'https://push.example/abc'), 1, 'one row per device');
select is((select user_id from public.push_subscriptions where endpoint = 'https://push.example/abc'),
  '00000000-0000-0000-0000-0000000000b1'::uuid, 'the device follows whoever signed in last');
select throws_ok($$select private.save_push_subscription_impl('00000000-0000-0000-0000-0000000000b1', 'http://insecure.example/x', 'p', 'a', null)$$,
  'P0001', 'keepup:invalid_subscription', 'push endpoints are https');
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1');
select public.delete_push_subscription('https://push.example/abc');
reset role;
select is((select count(*)::int from public.push_subscriptions where endpoint = 'https://push.example/abc'), 1, 'Anna cannot remove Dan''s device');

-- The job send-push reads, and its report back.
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
values ('00000000-0000-0000-0000-0000000000a1', 'https://push.example/annas', 'p', 'a');
insert into t select 'dan_nudge', (select id from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'nudge');
select is(jsonb_array_length(public.push_job((select v from t where k = 'dan_nudge')) -> 'subscriptions'), 2, 'the job lists Dan''s devices');
select is(public.push_job((select v from t where k = 'dan_nudge')) ->> 'actor', 'Anna', 'with names joined in');
select ok(public.push_job((select id from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'nudge'
                            and habit_id = (select v from t where k = 'run'))) is null,
  'no job for a row without push');
select public.push_done((select v from t where k = 'dan_nudge'), array['https://push.example/dead', 'https://push.example/annas']);
select ok((select pushed_at is not null from public.notifications where id = (select v from t where k = 'dan_nudge')), 'push_done marks it sent');
select is((select count(*)::int from public.push_subscriptions where user_id = '00000000-0000-0000-0000-0000000000b1'), 1, 'and drops the dead device');
select is((select count(*)::int from public.push_subscriptions where endpoint = 'https://push.example/annas'), 1, 'but only the recipient''s');
select ok((public.push_job((select v from t where k = 'dan_nudge')) ->> 'pushed')::boolean, 'a resent webhook sees it was already pushed');

-- RLS and privileges
select tests.authenticate_as('00000000-0000-0000-0000-0000000000e1');
select is((select count(*)::int from public.push_subscriptions), 0, 'Eve sees nobody''s devices');
select is((select count(*)::int from public.habit_user_settings), 0, 'nor their habit settings');
select is((select count(*)::int from public.notification_prefs), 0, 'nor their preferences');
select throws_ok($$insert into public.notification_prefs (user_id, category, enabled) values ('00000000-0000-0000-0000-0000000000e1', 'nudges', false)$$,
  '42501', null, 'tables are written only through functions');
reset role;
select ok(not has_function_privilege('authenticated', 'public.push_job(uuid, timestamptz)', 'execute'), 'signed-in people cannot read push jobs');
select ok(has_function_privilege('service_role', 'public.push_done(uuid, text[])', 'execute'), 'send-push can finish them');

-- #11 Private streak ended (feed only).
set local session_replication_role = replica;
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, requires_approval, created_at, created_by)
values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', null, 'Read', 'fitness', '📖', 1, 'day',
        current_date - 10, 1, false, now() - interval '10 days', '00000000-0000-0000-0000-0000000000a1');
insert into public.period_results (habit_id, period_start, outcome) values
  ('00000000-0000-0000-0000-0000000000d1', current_date - 9, 'done'),
  ('00000000-0000-0000-0000-0000000000d1', current_date - 8, 'done');
set local session_replication_role = origin;
insert into public.period_results (habit_id, period_start, outcome) values ('00000000-0000-0000-0000-0000000000d1', current_date - 7, 'missed');
select is((select (payload ->> 'streak')::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'private_streak_ended'),
  2, '#11: a missed day after a run tells the owner how long it was');
select ok((select not push from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'private_streak_ended'), 'feed only');
select is((select (payload ->> 'best')::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'private_streak_ended'),
  2, 'with the best streak, for "Your best is still …"');
insert into public.period_results (habit_id, period_start, outcome) values ('00000000-0000-0000-0000-0000000000d1', current_date - 6, 'missed');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'private_streak_ended'),
  1, 'a missed day with no run before it says nothing');

-- The approvals a job lists are those still open at p_now.
select private.check_in_impl((select v from t where k = 'tidy'), '00000000-0000-0000-0000-0000000000a1', now());
update public.notifications set push = true
 where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'approval_needed' and habit_id = (select v from t where k = 'tidy');
insert into t select 'dan_approval', (select id from public.notifications
  where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'approval_needed' and habit_id = (select v from t where k = 'tidy'));
select is(jsonb_array_length(public.push_job((select v from t where k = 'dan_approval'), now()) -> 'pending'), 1,
  'the job lists the approval waiting for Dan');
select is(jsonb_array_length(public.push_job((select v from t where k = 'dan_approval'), now() + interval '30 days') -> 'pending'), 0,
  'but not once its review window has closed at p_now');

-- A failing push never blocks the action (spec: Pipeline; the feed is always written).
delete from vault.secrets where name = 'send_push_url';
select private.nudge_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'walk'), '00000000-0000-0000-0000-0000000000b1', 'you_got_this', now());
select ok((select push from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'nudge'
            and habit_id = (select v from t where k = 'walk')),
  'without the webhook URL in Vault the row is still flagged');
select is((select count(*)::int from net.http_request_queue where headers ->> 'x-keepup-push-secret' = 'test-secret'), 1,
  'and nothing is called');
select vault.create_secret('not a url', 'send_push_url');
select lives_ok($$select private.nudge_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'run'), '00000000-0000-0000-0000-0000000000b1', 'thinking_of_you', now())$$,
  'a malformed webhook URL does not block the nudge');
select ok(exists (select 1 from public.nudges where sender_id = '00000000-0000-0000-0000-0000000000a1'
                   and recipient_id = '00000000-0000-0000-0000-0000000000b1' and habit_id = (select v from t where k = 'run')),
  'the nudge is saved');
select ok((select push from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'nudge'
            and habit_id = (select v from t where k = 'run')),
  'and its feed row, flagged for push');

select * from finish();
rollback;
