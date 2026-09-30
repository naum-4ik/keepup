begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');
select tests.create_user('00000000-0000-0000-0000-0000000000c1', 'carol@example.com', '{"full_name":"Carol"}');

create temp table t (k text primary key, v text) on commit drop;
grant all on t to authenticated;
insert into t select 'g', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Family', 'family')).id;
insert into public.group_members (group_id, user_id, role)
  select v::uuid, '00000000-0000-0000-0000-0000000000b1', 'member' from t where k = 'g';

select is((select avatar_emoji || '/' || coalesce(avatar_color, '-') from public.groups where id = (select v::uuid from t where k = 'g')),
  null, 'a new group has no avatar (it shows its initial)');

select lives_ok($$select private.set_group_avatar_impl('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'g'), '🏡', 'sage')$$,
  'an admin sets the group avatar');
select is((select avatar_emoji || '/' || avatar_color from public.groups where id = (select v::uuid from t where k = 'g')),
  '🏡/sage', 'the emoji and color are saved');

select throws_ok($$select private.set_group_avatar_impl('00000000-0000-0000-0000-0000000000b1', (select v::uuid from t where k = 'g'), '🍕', 'rose')$$,
  'P0001', 'keepup:not_admin', 'a member cannot change it');
select throws_ok($$select private.set_group_avatar_impl('00000000-0000-0000-0000-0000000000c1', (select v::uuid from t where k = 'g'), '🍕', 'rose')$$,
  'P0002', 'keepup:group_not_found', 'an outsider cannot see the group, let alone change it');
select throws_ok($$select private.set_group_avatar_impl('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'g'), '🍕', 'neon')$$,
  '23514', null, 'an unknown color is refused');

select lives_ok($$select private.set_group_avatar_impl('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'g'), '  ', 'peach')$$,
  'a blank emoji is accepted');
select is((select coalesce(avatar_emoji, 'none') from public.groups where id = (select v::uuid from t where k = 'g')),
  'none', 'and clears the emoji back to the initial');
select private.set_group_avatar_impl('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'g'), '🏡', 'sage');

select results_eq($$select avatar_emoji, avatar_color from private.my_groups_impl('00000000-0000-0000-0000-0000000000b1')$$,
  $$values ('🏡'::text, 'sage'::text)$$, 'my_groups returns the group avatar to members');
select is((select private.group_detail_impl('00000000-0000-0000-0000-0000000000b1', (select v::uuid from t where k = 'g'), now()) ->> 'avatar_emoji'),
  '🏡', 'group_detail returns it too');

select ok(not has_function_privilege('anon', 'public.set_group_avatar(uuid, text, text)', 'execute'),
  'signed-out visitors cannot call set_group_avatar');

-- Members read groups, but only through the admin-checked RPC can they change the avatar.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$update public.groups set avatar_emoji = '🍕' where id = (select v::uuid from t where k = 'g')$$,
  '42501', null, 'a direct update on groups is refused');
reset role;

select * from finish();
rollback;
