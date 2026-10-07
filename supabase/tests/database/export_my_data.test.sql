begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select tests.create_user('00000000-0000-0000-0000-0000000003a1', 'exp-anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000003b1', 'exp-ben@example.com', '{"full_name":"Ben"}');
create temp table t (k text primary key, v uuid) on commit drop;
grant all on t to authenticated;
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000003a1', 'Family', 'family')).id;
select private.accept_invite_impl('00000000-0000-0000-0000-0000000003b1',
  (private.create_invite_impl('00000000-0000-0000-0000-0000000003a1', (select v from t where k='fam'), now())).token, now());
insert into t select 'kid', private.create_child_impl('00000000-0000-0000-0000-0000000003a1', (select v from t where k='fam'), 'Mia', '🐱', 'sky', true);
insert into public.habits (owner_id, created_by, title, emoji, category, target_count, period, starts_on)
values ('00000000-0000-0000-0000-0000000003a1', '00000000-0000-0000-0000-0000000003a1', 'Anna reads', '📚', 'learning', 1, 'day', current_date),
       ('00000000-0000-0000-0000-0000000003b1', '00000000-0000-0000-0000-0000000003b1', 'Ben secret', '🤫', 'mind', 1, 'day', current_date);
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
values ('00000000-0000-0000-0000-0000000003a1', 'https://push.example/1', 'P256-SECRET', 'AUTH-SECRET', 'iPhone Safari');

create temp table out_anna (j jsonb) on commit drop;
create temp table out_ben (j jsonb) on commit drop;
grant all on out_anna, out_ben to authenticated;

select ok(not has_function_privilege('anon', 'public.export_my_data()', 'execute'), 'anon cannot export');
select tests.authenticate_as('00000000-0000-0000-0000-0000000003a1');
insert into out_anna select public.export_my_data();
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000003b1');
insert into out_ben select public.export_my_data();
reset role;

select is((select j->>'format' from out_anna), 'keepup-export-v1', 'format tag');
select is((select j->>'email' from out_anna), 'exp-anna@example.com', 'own email');
select is((select j->'profile'->>'display_name' from out_anna), 'Anna', 'own profile');
select is((select jsonb_array_length(j->'private_habits') from out_anna), 1, 'only own private habits');
select ok((select j::text from out_anna) not like '%Ben secret%', 'no one else''s private habit');
select ok((select j::text from out_anna) not like '%P256-SECRET%' and (select j::text from out_anna) not like '%AUTH-SECRET%', 'push keys never exported');
select is((select j->'push_devices'->0->>'user_agent' from out_anna), 'iPhone Safari', 'device listed');
select is((select j->'groups'->0->>'role' from out_anna), 'admin', 'membership with role');
select is((select jsonb_array_length(j->'children') from out_anna), 1, 'admin export includes the group''s child');
select is((select jsonb_array_length(j->'children') from out_ben), 0, 'member export has no children');
select throws_ok($$select private.export_my_data_impl('00000000-0000-0000-0000-00000000dead')$$, 'P0002', 'keepup:not_found', 'unknown user');

select * from finish();
rollback;
