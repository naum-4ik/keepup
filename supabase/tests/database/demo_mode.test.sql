begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

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

-- Cleanup after 24 hours
select tests.create_anonymous_user('00000000-0000-0000-0000-0000000005a2');  -- fresh visitor
update public.profiles set created_at = now() - interval '25 hours' where id in ('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000005f1');
update auth.users set created_at = now() - interval '25 hours' where id in ('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000005f1');
update public.groups set created_at = now() - interval '25 hours' where id = (select v from t where k='real');
insert into public.profiles (id, display_name, is_demo, created_at) values ('00000000-0000-0000-0000-0000000005b1', 'Alex', true, now() - interval '25 hours');
select is(private.cleanup_demo(now()), 2, 'old visitor and old bot removed');
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-0000000005a1'), 0, 'old demo login deleted');
select is((select count(*)::int from public.groups where id = (select v from t where k='demo')), 0, 'its group deleted');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000005a2'), 1, 'a visitor under 24h stays');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000005f1'), 1, 'an old real user stays');
select is((select count(*)::int from public.groups where id = (select v from t where k='real')), 1, 'an old real group stays');
select ok(exists (select 1 from cron.job where jobname = 'keepup-demo-cleanup'), 'cleanup is scheduled');
-- A converted login keeps is_demo but is real now: cleanup must not delete it.
select tests.create_anonymous_user('00000000-0000-0000-0000-0000000005a3');
insert into t select 'conv', (private.create_group_impl('00000000-0000-0000-0000-0000000005a3', 'Converted family', 'family')).id;
update public.groups set created_at = now() - interval '25 hours' where id = (select v from t where k='conv');
-- The old bot is an active member of the converted user's group: the group must still survive.
insert into public.profiles (id, display_name, is_demo, created_at) values ('00000000-0000-0000-0000-0000000005b3', 'Alex', true, now() - interval '25 hours');
insert into public.group_members (group_id, user_id) values ((select v from t where k='conv'), '00000000-0000-0000-0000-0000000005b3');
-- A demo group whose creator is gone (created_by null) with only an old bot left in it.
insert into public.profiles (id, display_name, is_demo, created_at) values ('00000000-0000-0000-0000-0000000005b2', 'Alex', true, now() - interval '25 hours');
with g as (insert into public.groups (name, kind, timezone, week_start, created_by) values ('Orphan', 'family', 'UTC', 1, null) returning id)
insert into t select 'orphan', id from g;
insert into public.group_members (group_id, user_id) values ((select v from t where k='orphan'), '00000000-0000-0000-0000-0000000005b2');
update auth.users set is_anonymous = false, email = 'converted@example.com', created_at = now() - interval '25 hours' where id = '00000000-0000-0000-0000-0000000005a3';
update public.profiles set created_at = now() - interval '25 hours' where id = '00000000-0000-0000-0000-0000000005a3';
select private.cleanup_demo(now());
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000005a3'), 1, 'a converted login is never cleaned up');
select is((select count(*)::int from public.groups where id = (select v from t where k='conv')), 1, 'a converted login''s group is never cleaned up');
select is((select count(*)::int from public.groups where id = (select v from t where k='orphan')), 0, 'a demo group with no creator goes with its old bot');

select * from finish();
rollback;
