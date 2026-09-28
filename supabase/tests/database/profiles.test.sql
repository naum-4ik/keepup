begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

select tests.create_user('00000000-0000-0000-0000-00000000000a', 'ana@example.com', '{"full_name":"Ana Example"}');
select tests.create_user('00000000-0000-0000-0000-00000000000b', 'bob@example.com');
select tests.create_user('00000000-0000-0000-0000-00000000000c', null);
select tests.create_user('00000000-0000-0000-0000-00000000000d', 'long@example.com',
  jsonb_build_object('full_name', repeat('x', 60)));
select lives_ok(
  $$select tests.create_user('00000000-0000-0000-0000-00000000000e', 'edge@example.com',
      jsonb_build_object('full_name', repeat('m', 39) || ' '))$$,
  'signup succeeds when the 40th character of full_name is a space');

-- Guard: every table in public has RLS on.
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0, 'every public table has RLS enabled');

-- Signup trigger
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'Ana Example', 'display name comes from full_name');
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  'bob', 'display name falls back to the email local part');
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000c'),
  'Guest', 'a user without email or name is Guest');
select is((select char_length(display_name) from public.profiles where id = '00000000-0000-0000-0000-00000000000d'),
  40, 'long names are truncated to 40 characters');
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000e'),
  repeat('m', 39), 'a cut landing on a space is trimmed again, leaving no trailing space');
select ok((select timezone = 'UTC' and reminder_hour = 20 and onboarded_at is null
           from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'new profiles default to UTC, 20:00, not onboarded');

-- As Ana
select tests.authenticate_as('00000000-0000-0000-0000-00000000000a');

select is((select count(*)::int from public.profiles), 1, 'a user sees only their own profile');
select lives_ok(
  $$update public.profiles set display_name = 'Ana', timezone = 'Asia/Jerusalem', reminder_hour = 7
    where id = '00000000-0000-0000-0000-00000000000a'$$,
  'a user can update their own profile');
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'Ana', 'the update is applied');
select throws_ok(
  $$update public.profiles set timezone = 'Not/AZone' where id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'unknown time zones are rejected');
select throws_ok(
  $$update public.profiles set timezone = '+03' where id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'raw UTC offsets are rejected');
select throws_ok(
  $$update public.profiles set reminder_hour = 24 where id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'reminder hour must be 0-23');
select throws_ok(
  $$update public.profiles set display_name = '   ' where id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'blank display names are rejected');
select throws_ok(
  $$update public.profiles set display_name = 'Ana ' where id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'a stored value with trailing spaces is rejected');
select throws_ok(
  $$update public.profiles set display_name = E'\t' where id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'a tab-only display name is rejected');
select throws_ok(
  $$update public.profiles set display_name = chr(160) where id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'an NBSP-only display name is rejected');
select throws_ok(
  $$insert into public.profiles (id, display_name) values ('00000000-0000-0000-0000-00000000000b', 'x')$$,
  '42501', null, 'users cannot insert profiles');
select throws_ok(
  $$delete from public.profiles where id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'users cannot delete profiles');
select throws_ok(
  $$update public.profiles set created_at = now() where id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'users cannot change created_at');

-- Attempt to edit Bob's row: RLS filters it out silently.
update public.profiles set display_name = 'hacked' where id = '00000000-0000-0000-0000-00000000000b';

reset role;
set local role anon;
select throws_ok($$select * from public.profiles$$, '42501', null, 'anonymous visitors cannot read profiles');
reset role;

select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  'bob', 'a user cannot update someone else''s profile');

select * from finish();
rollback;
