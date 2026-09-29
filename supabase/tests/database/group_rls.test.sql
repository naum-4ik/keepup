begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');
select tests.create_user('00000000-0000-0000-0000-0000000000c1', 'carol@example.com', '{"full_name":"Carol"}');

create temp table t (k text primary key, v uuid) on commit drop;
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Family', 'family')).id;
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000b1',
  (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), now())).token, now());
insert into t select 'mary', private.create_child_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), 'Mary', '🐼', 'peach', true);
insert into t select 'brush', (private.create_child_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'mary'), 'Brush teeth', '🪥', 2, 'day', null)).id;
insert into t select 'dinner', (private.create_group_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'),
  'Family dinner', '🍽️', 'people', 1, 'day', null, false, '{}', now())).id;
insert into public.habits (owner_id, title, category, target_count, period) values ('00000000-0000-0000-0000-0000000000a1', 'Private', 'mind', 1, 'day');
select private.check_in_impl((select v from t where k = 'brush'), '00000000-0000-0000-0000-0000000000a1', now(), (select v from t where k = 'mary'));
select private.check_in_impl((select v from t where k = 'dinner'), '00000000-0000-0000-0000-0000000000a1', now());

-- Dan (member) sees group and child data, not Anna's private habit or anyone's profile row
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select set_eq($$select title from public.habits$$, $$values ('Brush teeth'), ('Family dinner')$$,
  'a member reads the group''s habits and the child''s habits, not another member''s private ones');
select is((select count(*)::int from public.check_ins), 2, 'and their check-ins');
select is((select count(*)::int from public.profiles), 1, 'a member reads only their own profile row');
select lives_ok($$update public.habits set title = 'Brush teeth well' where title = 'Brush teeth'$$, 'any adult edits a child''s habit');
select is((select count(*)::int from public.habits where title = 'Brush teeth well'), 1, 'the edit applies');
update public.habits set title = 'Dinner!' where title = 'Family dinner';
select is((select count(*)::int from public.habits where title = 'Family dinner'), 1, 'a member cannot edit a group habit (admins only)');
select throws_ok($$insert into public.check_ins (habit_id, user_id, local_date, period_start) values ((select id from public.habits where title = 'Family dinner'), auth.uid(), current_date, current_date)$$,
  '42501', null, 'nobody inserts check-ins directly');
select throws_ok($$update public.check_ins set status = 'approved'$$, '42501', null, 'nobody reviews by updating rows');
reset role;

-- Carol (outsider) sees nothing
select tests.authenticate_as('00000000-0000-0000-0000-0000000000c1');
select is_empty($$select 1 from public.habits$$, 'an outsider sees no habits');
select is_empty($$select 1 from public.check_ins$$, 'no check-ins');
select is_empty($$select 1 from public.group_habit_participants$$, 'no participants');
select is_empty($$select 1 from public.treat_goals$$, 'no treat goals');
reset role;

select * from finish();
rollback;
