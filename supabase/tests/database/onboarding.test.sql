begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select tests.create_user('00000000-0000-0000-0000-0000000000aa', 'onboard@example.com');
select tests.authenticate_as('00000000-0000-0000-0000-0000000000aa');

-- Onboarding: setting onboarded_at on a fresh (null) row stores ~now(), not the client's value.
update public.profiles set onboarded_at = now() + interval '10 years'
  where id = '00000000-0000-0000-0000-0000000000aa';
select ok(
  (select onboarded_at from public.profiles where id = '00000000-0000-0000-0000-0000000000aa')
    between now() - interval '5 seconds' and now() + interval '5 seconds',
  'setting onboarded_at to a future date stores ~now(), not the future date');

-- Setting it again (to a different future date) does not change the already-set value.
select onboarded_at as first_value from public.profiles where id = '00000000-0000-0000-0000-0000000000aa' \gset
update public.profiles set onboarded_at = now() + interval '20 years'
  where id = '00000000-0000-0000-0000-0000000000aa';
select is(
  (select onboarded_at from public.profiles where id = '00000000-0000-0000-0000-0000000000aa'),
  :'first_value'::timestamptz,
  'setting onboarded_at again does not change the stored value');

-- Setting it to null keeps the old value (it can never be cleared).
update public.profiles set onboarded_at = null where id = '00000000-0000-0000-0000-0000000000aa';
select is(
  (select onboarded_at from public.profiles where id = '00000000-0000-0000-0000-0000000000aa'),
  :'first_value'::timestamptz,
  'setting onboarded_at to null keeps the old value');

-- Bypass the trigger (as postgres, replica mode) to seed a known past value, so the next
-- assertion can't pass just because the trigger always writes now() regardless of old.
reset role;
set local session_replication_role = replica;
update public.profiles set onboarded_at = '2020-01-01T00:00:00Z'
  where id = '00000000-0000-0000-0000-0000000000aa';
set local session_replication_role = origin;

select tests.authenticate_as('00000000-0000-0000-0000-0000000000aa');
update public.profiles set onboarded_at = now() where id = '00000000-0000-0000-0000-0000000000aa';
select is(
  (select onboarded_at from public.profiles where id = '00000000-0000-0000-0000-0000000000aa'),
  '2020-01-01T00:00:00Z'::timestamptz,
  'a value already set is never overwritten, even by a fresh now() attempt');

-- Valid time zone updates still work for authenticated (is_valid_timezone stays callable by the
-- check constraint's caller).
select lives_ok(
  $$update public.profiles set timezone = 'Asia/Jerusalem' where id = '00000000-0000-0000-0000-0000000000aa'$$,
  'authenticated can still update to a valid time zone');
select throws_ok(
  $$update public.profiles set timezone = 'Not/AZone' where id = '00000000-0000-0000-0000-0000000000aa'$$,
  '23514', null, 'authenticated updates to an unknown time zone are still rejected');

-- anon cannot execute is_valid_timezone directly.
reset role;
set local role anon;
select throws_ok(
  $$select public.is_valid_timezone('UTC')$$,
  '42501', null, 'anon cannot execute is_valid_timezone');
reset role;

select * from finish();
rollback;
