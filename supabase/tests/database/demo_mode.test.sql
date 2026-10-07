begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select tests.create_anonymous_user('00000000-0000-0000-0000-0000000005a1');
select tests.create_user('00000000-0000-0000-0000-0000000005f1', 'demo-real@example.com', '{"full_name":"Real"}');
create temp table t (k text primary key, v uuid) on commit drop;
grant all on t to authenticated;

select ok((select is_demo from public.profiles where id = '00000000-0000-0000-0000-0000000005a1'), 'anonymous sign-in makes a demo profile');
select ok(not (select is_demo from public.profiles where id = '00000000-0000-0000-0000-0000000005f1'), 'a real sign-up is not demo');
select tests.authenticate_as('00000000-0000-0000-0000-0000000005a1');
select throws_ok($$update public.profiles set is_demo = false where id = auth.uid()$$, '42501', null, 'a demo user cannot clear the flag');
reset role;

select * from finish();
rollback;
