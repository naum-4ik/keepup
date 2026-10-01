-- supabase/tests/database/push_subscription_guard.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000e1', 'eve@example.com', '{"full_name":"Eve"}');

-- Known push services only: send-push posts to whatever is saved here.
select ok(private.is_push_service_endpoint('https://fcm.googleapis.com/fcm/send/abc'), 'FCM (Chrome, Android)');
select ok(private.is_push_service_endpoint('https://updates.push.services.mozilla.com/wpush/v2/abc'), 'Mozilla (Firefox)');
select ok(private.is_push_service_endpoint('https://web.push.apple.com/QGx'), 'Apple (Safari, iPhone)');
select ok(private.is_push_service_endpoint('https://wns2-par02p.notify.windows.com/w/?token=abc'), 'WNS (Edge on Windows)');
select ok(not private.is_push_service_endpoint('https://push.example/abc'), 'not an unknown host');
select ok(not private.is_push_service_endpoint('https://api.push.apple.com/3/device/abc'), 'not native APNs (only web.push.apple.com)');
select ok(not private.is_push_service_endpoint('https://fcm.googleapis.com.evil.example/x'), 'not a look-alike host');
select ok(not private.is_push_service_endpoint('https://fcm.googleapis.com@evil.example/x'), 'not a host hidden behind userinfo');
select ok(not private.is_push_service_endpoint('http://fcm.googleapis.com/fcm/send/abc'), 'not plain http');
select throws_ok($$select private.save_push_subscription_impl('00000000-0000-0000-0000-0000000000a1', 'https://169.254.169.254/latest', 'p', 'a', null)$$,
  'P0001', 'keepup:invalid_subscription', 'saving an unknown host is refused');

-- Knowing someone's endpoint is not enough to take their device.
select private.save_push_subscription_impl('00000000-0000-0000-0000-0000000000a1', 'https://fcm.googleapis.com/fcm/send/anna', 'p256-anna', 'auth-anna', null);
select throws_ok($$select private.save_push_subscription_impl('00000000-0000-0000-0000-0000000000e1', 'https://fcm.googleapis.com/fcm/send/anna', 'p256-eve', 'auth-eve', null)$$,
  'P0001', 'keepup:invalid_subscription', 'another account with other keys is refused');
select is((select user_id::text || ' ' || p256dh || ' ' || auth from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/anna'),
  '00000000-0000-0000-0000-0000000000a1 p256-anna auth-anna', 'and Anna keeps her device with her keys');
select private.save_push_subscription_impl('00000000-0000-0000-0000-0000000000a1', 'https://fcm.googleapis.com/fcm/send/anna', 'p256-new', 'auth-new', null);
select is((select p256dh from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/anna'), 'p256-new',
  'her own browser may renew its keys');
select private.save_push_subscription_impl('00000000-0000-0000-0000-0000000000e1', 'https://fcm.googleapis.com/fcm/send/anna', 'p256-new', 'auth-new', null);
select is((select user_id from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/anna'),
  '00000000-0000-0000-0000-0000000000e1'::uuid, 'the same browser (same keys) follows whoever signed in last');

-- At most 10 devices per account; the oldest go first.
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
select '00000000-0000-0000-0000-0000000000a1', 'https://fcm.googleapis.com/fcm/send/old' || i, 'p', 'a', now() - make_interval(days => 20 - i)
  from generate_series(1, 10) i;
select private.save_push_subscription_impl('00000000-0000-0000-0000-0000000000a1', 'https://web.push.apple.com/newest', 'p', 'a', null);
select is((select count(*)::int from public.push_subscriptions where user_id = '00000000-0000-0000-0000-0000000000a1'), 10,
  'an eleventh device keeps ten');
select ok(not exists (select 1 from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/old1')
          and exists (select 1 from public.push_subscriptions where endpoint = 'https://web.push.apple.com/newest'),
  'dropping the oldest, keeping the new one');
select is((select count(*)::int from public.push_subscriptions where user_id = '00000000-0000-0000-0000-0000000000e1'), 1,
  'nobody else''s devices are touched');

select * from finish();
rollback;
