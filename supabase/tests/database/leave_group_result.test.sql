begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');

create temp table t (k text primary key, v uuid) on commit drop;

-- Family: Anna (admin) and Dan, with a child; Solo: Anna alone, no children.
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Family', 'family')).id;
insert into t select 'solo', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Solo', 'other')).id;
-- Club: Anna (admin) and Dan, for the call through the public wrapper.
insert into t select 'club', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Club', 'friends')).id;
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000b1',
  (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'club'), now())).token, now());
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000b1',
  (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), now())).token, now());
select private.create_child_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), 'Mary', '🐼', 'peach', true);

select is(private.leave_group_impl('00000000-0000-0000-0000-0000000000b1', (select v from t where k = 'fam'), false, now()),
  '{"deleted": false, "children_deleted": 0}'::jsonb, 'a member leaving a group with others: not deleted');

select is(private.leave_group_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'solo'), false, now()),
  '{"deleted": true, "children_deleted": 0}'::jsonb, 'the only member leaving deletes the group');
select is((select count(*)::int from public.groups where id = (select v from t where k = 'solo')), 0, 'and the group is gone');

select throws_ok($$select private.leave_group_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), false, now())$$,
  'P0001', 'keepup:children_would_be_deleted', 'the last adult is still warned about the child');
select is(private.leave_group_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), true, now()),
  '{"deleted": true, "children_deleted": 1}'::jsonb, 'confirmed, it says how many children went with the group');

-- The public function answers the same shape to a signed-in caller, and nobody else may call it.
select ok(not has_function_privilege('anon', 'public.leave_group(uuid, boolean)', 'execute'), 'anon cannot leave groups');
select ok(has_function_privilege('authenticated', 'public.leave_group(uuid, boolean)', 'execute'), 'a signed-in user can');

-- Through the wrapper, as Dan (JWT claims set): the same answer, for the caller.
create temp table club_id on commit drop as select v from t where k = 'club';
grant select on club_id to authenticated;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select is(public.leave_group((select v from club_id)), '{"deleted": false, "children_deleted": 0}'::jsonb,
  'public.leave_group answers for the signed-in caller');
reset role;
select is((select left_at is not null from public.group_members
            where group_id = (select v from t where k = 'club') and user_id = '00000000-0000-0000-0000-0000000000b1'), true,
  'and Dan has left the club');

select * from finish();
rollback;
