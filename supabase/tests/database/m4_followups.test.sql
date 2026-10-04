-- supabase/tests/database/m4_followups.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

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

select * from finish();
rollback;
