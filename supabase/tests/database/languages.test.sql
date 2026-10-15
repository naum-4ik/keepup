begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select tests.create_user('00000000-0000-0000-0000-0000000004a1', 'lang-anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000004b1', 'lang-ben@example.com', '{"full_name":"Ben"}');
create temp table t (k text primary key, v uuid) on commit drop;
grant all on t to authenticated;
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000004a1', 'Family', 'family')).id;
insert into t select 'kid', private.create_child_impl('00000000-0000-0000-0000-0000000004a1', (select v from t where k='fam'), 'Mia', '🐱', 'sky', true);

select has_column('public', 'profiles', 'locale', 'profiles.locale exists');
select has_column('public', 'profiles', 'gender', 'profiles.gender exists');

-- A person sets their own language; a bad value is refused.
select tests.authenticate_as('00000000-0000-0000-0000-0000000004a1');
update public.profiles set locale = 'ru' where id = '00000000-0000-0000-0000-0000000004a1';
select is((select locale from public.profiles where id = '00000000-0000-0000-0000-0000000004a1'), 'ru', 'own locale saved');
select throws_ok($$update public.profiles set locale = 'fr' where id = '00000000-0000-0000-0000-0000000004a1'$$, '23514', null, 'unknown locale refused');

-- The guardian sets the kid's gender; null clears; a bad value is refused; a stranger is refused.
select lives_ok($$select public.set_child_gender((select v from t where k='kid'), 'girl')$$, 'guardian sets gender');
reset role;
select is((select gender from public.profiles where id = (select v from t where k='kid')), 'girl', 'gender saved');
select tests.authenticate_as('00000000-0000-0000-0000-0000000004a1');
select throws_ok($$select public.set_child_gender((select v from t where k='kid'), 'x')$$, '22023', 'keepup:invalid_gender', 'bad gender refused');
select public.set_child_gender((select v from t where k='kid'), null);
reset role;
select is((select gender from public.profiles where id = (select v from t where k='kid')), null, 'null clears');
select tests.authenticate_as('00000000-0000-0000-0000-0000000004a1');
select tests.authenticate_as('00000000-0000-0000-0000-0000000004b1');
select throws_like($$select public.set_child_gender((select v from t where k='kid'), 'boy')$$, 'keepup:%', 'stranger refused');
reset role;

select ok(((private.export_child_impl('00000000-0000-0000-0000-0000000004a1', (select v from t where k='kid'))) -> 'profile') ? 'gender', 'child export contains gender');

-- my_children shows the kid's gender to a guardian (null until set).
select is((select gender from private.my_children_impl('00000000-0000-0000-0000-0000000004a1') where child_id = (select v from t where k='kid')), null, 'my_children: gender null until set');
update public.profiles set gender = 'boy' where id = (select v from t where k='kid');
select is((select gender from private.my_children_impl('00000000-0000-0000-0000-0000000004a1') where child_id = (select v from t where k='kid')), 'boy', 'my_children: gender returned');
select tests.authenticate_as('00000000-0000-0000-0000-0000000004a1');
select is((select gender from public.my_children() where child_id = (select v from t where k='kid')), 'boy', 'my_children(): authenticated guardian reads gender');
reset role;

-- The push job carries the recipient's language.
insert into public.notifications (user_id, kind, push) values ('00000000-0000-0000-0000-0000000004a1', 'nudge', true);
select is(private.push_job_build((select id from public.notifications where user_id = '00000000-0000-0000-0000-0000000004a1' limit 1)) ->> 'locale', 'ru', 'push job locale');

select * from finish();
rollback;
