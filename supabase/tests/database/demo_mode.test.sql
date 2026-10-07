begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select tests.create_anonymous_user('00000000-0000-0000-0000-0000000005a1');
select tests.create_user('00000000-0000-0000-0000-0000000005f1', 'demo-real@example.com', '{"full_name":"Real"}');
create temp table t (k text primary key, v uuid) on commit drop;
grant all on t to authenticated;

select ok((select is_demo from public.profiles where id = '00000000-0000-0000-0000-0000000005a1'), 'anonymous sign-in makes a demo profile');
select ok(not (select is_demo from public.profiles where id = '00000000-0000-0000-0000-0000000005f1'), 'a real sign-up is not demo');
select tests.authenticate_as('00000000-0000-0000-0000-0000000005a1');
select throws_ok($$update public.profiles set is_demo = false where id = auth.uid()$$, '42501', null, 'a demo user cannot clear the flag');
reset role;

insert into t select 'real', (private.create_group_impl('00000000-0000-0000-0000-0000000005f1', 'Real family', 'family')).id;
insert into t select 'demo', (private.create_group_impl('00000000-0000-0000-0000-0000000005a1', 'Family', 'family')).id;
select throws_ok($$select private.create_invite_impl('00000000-0000-0000-0000-0000000005a1', (select v from t where k='demo'), now())$$,
  '42501', 'keepup:demo', 'a demo user cannot create invites');
select throws_ok($$select private.accept_invite_impl('00000000-0000-0000-0000-0000000005a1',
  (private.create_invite_impl('00000000-0000-0000-0000-0000000005f1', (select v from t where k='real'), now())).token, now())$$,
  '42501', 'keepup:demo', 'a demo user cannot join a real group');
select throws_ok($$insert into public.group_members (group_id, user_id) values ((select v from t where k='demo'), '00000000-0000-0000-0000-0000000005f1')$$,
  '42501', 'keepup:demo', 'a real user cannot join a demo group');
select throws_ok($$select private.save_push_subscription_impl('00000000-0000-0000-0000-0000000005a1', 'https://fcm.googleapis.com/fcm/send/demo', 'k', 'a', 'ua')$$,
  '42501', 'keepup:demo', 'a demo user cannot add a push device');

select * from finish();
rollback;
