begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');
select tests.create_user('00000000-0000-0000-0000-0000000000c1', 'carol@example.com', '{"full_name":"Carol"}');

create temp table t (k text primary key, v uuid) on commit drop;
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Family', 'family')).id;
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000b1',
  (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), now())).token, now());
insert into t select 'mary', private.create_child_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), 'Mary', '🐼', 'sage', true);

select is((select kid_theme from private.my_children_impl('00000000-0000-0000-0000-0000000000a1')), 'garden',
  'a new child grows the garden');

select lives_ok($$select private.set_child_theme_impl('00000000-0000-0000-0000-0000000000b1', (select v from t where k = 'mary'), 'aquarium')$$,
  'any adult member can change it (not only admins)');
select is((select kid_theme from private.my_children_impl('00000000-0000-0000-0000-0000000000a1')), 'aquarium',
  'and every adult sees the new theme');

select throws_ok($$select private.set_child_theme_impl('00000000-0000-0000-0000-0000000000c1', (select v from t where k = 'mary'), 'space')$$,
  'P0002', 'keepup:child_not_found', 'an outsider cannot see the child');
select throws_ok($$select private.set_child_theme_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'mary'), 'jungle')$$,
  '23514', null, 'an unknown theme is refused');

select lives_ok($$select private.set_child_theme_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'mary'), 'garden')$$,
  'back to the garden');
select is((select kid_theme from public.profiles where id = (select v from t where k = 'mary')), null, 'garden is stored as the default (null)');

select throws_ok($$update public.profiles set kid_theme = 'space' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '23514', null, 'only children have a theme');
select ok(not has_function_privilege('anon', 'public.set_child_theme(uuid, text)', 'execute'), 'signed-out visitors cannot call set_child_theme');

select * from finish();
rollback;
