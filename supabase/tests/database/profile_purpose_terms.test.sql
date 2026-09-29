begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'purpose@example.com');
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');

-- purpose: the three answers or null; anything else is rejected by the check.
select lives_ok(
  $$update public.profiles set purpose = 'family' where id = '00000000-0000-0000-0000-0000000000b1'$$,
  'authenticated can set purpose to family');
select throws_ok(
  $$update public.profiles set purpose = 'work' where id = '00000000-0000-0000-0000-0000000000b1'$$,
  '23514', null, 'an unknown purpose is rejected');
select lives_ok(
  $$update public.profiles set purpose = null where id = '00000000-0000-0000-0000-0000000000b1'$$,
  'purpose can be cleared (null = not answered)');

-- terms_accepted_at: clients can't write it.
select throws_ok(
  $$update public.profiles set terms_accepted_at = now() where id = '00000000-0000-0000-0000-0000000000b1'$$,
  '42501', null, 'a client cannot set terms_accepted_at');

-- Other updates before onboarding leave it null.
update public.profiles set display_name = 'Pia' where id = '00000000-0000-0000-0000-0000000000b1';
select is(
  (select terms_accepted_at from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'),
  null, 'terms_accepted_at stays null until onboarding completes');

-- Completing onboarding sets it to ~now().
update public.profiles set onboarded_at = now() where id = '00000000-0000-0000-0000-0000000000b1';
select ok(
  (select terms_accepted_at from public.profiles where id = '00000000-0000-0000-0000-0000000000b1')
    between now() - interval '5 seconds' and now() + interval '5 seconds',
  'completing onboarding sets terms_accepted_at to ~now()');

-- Seed a known past value (bypassing triggers) so the next checks can't pass by always writing now().
reset role;
set local session_replication_role = replica;
update public.profiles set terms_accepted_at = '2020-01-01T00:00:00Z'
  where id = '00000000-0000-0000-0000-0000000000b1';
set local session_replication_role = origin;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');

update public.profiles set onboarded_at = now(), purpose = 'friends' where id = '00000000-0000-0000-0000-0000000000b1';
select is(
  (select terms_accepted_at from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'),
  '2020-01-01T00:00:00Z'::timestamptz, 'later updates never move terms_accepted_at');

-- Even the table owner can't overwrite or clear it through a normal update.
reset role;
update public.profiles set terms_accepted_at = null where id = '00000000-0000-0000-0000-0000000000b1';
select is(
  (select terms_accepted_at from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'),
  '2020-01-01T00:00:00Z'::timestamptz, 'terms_accepted_at cannot be cleared');

select ok(not has_function_privilege('anon', 'public.protect_terms_accepted_at()', 'execute'),
  'anon cannot execute protect_terms_accepted_at');
select ok(has_function_privilege('authenticated', 'public.protect_terms_accepted_at()', 'execute'),
  'authenticated keeps execute on protect_terms_accepted_at');

select * from finish();
rollback;
