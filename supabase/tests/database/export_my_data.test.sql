begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

select tests.create_user('00000000-0000-0000-0000-0000000003a1', 'exp-anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000003b1', 'exp-ben@example.com', '{"full_name":"Ben"}');
select tests.create_user('00000000-0000-0000-0000-0000000003c1', 'exp-cara@example.com', '{"full_name":"Cara"}');
create temp table t (k text primary key, v uuid) on commit drop;
grant all on t to authenticated;
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000003a1', 'Family', 'family')).id;
select private.accept_invite_impl('00000000-0000-0000-0000-0000000003b1',
  (private.create_invite_impl('00000000-0000-0000-0000-0000000003a1', (select v from t where k='fam'), now())).token, now());
-- Cara was an admin of Family and has left: she no longer sees its children.
select private.accept_invite_impl('00000000-0000-0000-0000-0000000003c1',
  (private.create_invite_impl('00000000-0000-0000-0000-0000000003a1', (select v from t where k='fam'), now())).token, now());
update public.group_members set role = 'admin' where user_id = '00000000-0000-0000-0000-0000000003c1';
update public.group_members set left_at = now() where user_id = '00000000-0000-0000-0000-0000000003c1';
insert into t select 'kid', private.create_child_impl('00000000-0000-0000-0000-0000000003a1', (select v from t where k='fam'), 'Mia', '🐱', 'sky', true);
insert into public.habits (owner_id, created_by, title, emoji, category, target_count, period, starts_on)
values ('00000000-0000-0000-0000-0000000003a1', '00000000-0000-0000-0000-0000000003a1', 'Anna reads', '📚', 'learning', 1, 'day', current_date),
       ('00000000-0000-0000-0000-0000000003b1', '00000000-0000-0000-0000-0000000003b1', 'Ben secret', '🤫', 'mind', 1, 'day', current_date);
-- A group habit both take part in: each one's check-in is theirs alone.
insert into t select 'dinner', (private.create_group_habit_impl('00000000-0000-0000-0000-0000000003a1', (select v from t where k='fam'),
  'Family dinner', '🍽️', 'people', 1, 'day', null, false, '{}', now())).id;
insert into t select 'anna_ci', (private.check_in_impl((select v from t where k='dinner'), '00000000-0000-0000-0000-0000000003a1', now())).id;
insert into t select 'ben_ci', (private.check_in_impl((select v from t where k='dinner'), '00000000-0000-0000-0000-0000000003b1', now())).id;
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
values ('00000000-0000-0000-0000-0000000003a1', 'https://push.example/1', 'P256-SECRET', 'AUTH-SECRET', 'iPhone Safari');

create temp table out_anna (j jsonb) on commit drop;
create temp table out_ben (j jsonb) on commit drop;
create temp table out_cara (j jsonb) on commit drop;
grant all on out_anna, out_ben, out_cara to authenticated;

select ok(not has_function_privilege('anon', 'public.export_my_data()', 'execute'), 'anon cannot export');
select tests.authenticate_as('00000000-0000-0000-0000-0000000003a1');
insert into out_anna select public.export_my_data();
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000003b1');
insert into out_ben select public.export_my_data();
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000003c1');
insert into out_cara select public.export_my_data();
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
select is((select jsonb_agg(c->>'id') from out_anna, jsonb_array_elements(j->'check_ins') c),
          jsonb_build_array((select v from t where k='anna_ci')), 'Anna''s export: her group check-in only');
select is((select jsonb_agg(c->>'id') from out_ben, jsonb_array_elements(j->'check_ins') c),
          jsonb_build_array((select v from t where k='ben_ci')), 'Ben''s export: his group check-in only');
select is((select j->'groups'->0->>'role' from out_cara) || ' ' || (select j->'groups'->0->>'left_at' is not null from out_cara)::text,
          'admin true', 'setup: Cara left Family as an admin');
select is((select jsonb_array_length(j->'children') from out_cara), 0, 'a left admin''s export has no children');
-- Pinned on purpose: a new profiles column fails here until it's consciously added to (or kept out of) the export.
select set_eq($$select jsonb_object_keys(j->'profile') from out_anna$$,
  array['avatar_color', 'avatar_emoji', 'celebrations', 'created_at', 'data_reset_at', 'display_name', 'id', 'is_demo',
        'muted_until', 'onboarded_at', 'purpose', 'reminder_hour', 'terms_accepted_at', 'timezone', 'week_start'],
  'the profile export''s keys are exactly these');
select throws_ok($$select private.export_my_data_impl('00000000-0000-0000-0000-00000000dead')$$, 'P0002', 'keepup:not_found', 'unknown user');

select * from finish();
rollback;
