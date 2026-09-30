begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');
select tests.create_user('00000000-0000-0000-0000-0000000000c1', 'carol@example.com', '{"full_name":"Carol"}');

create temp table t (k text primary key, v uuid) on commit drop;

-- Family: Anna admin, Dan member; Mary and Leo are Anna's children there.
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Family', 'family')).id;
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000b1',
  (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), now())).token, now());
insert into t select 'mary', private.create_child_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), 'Mary', '🐼', 'sage', true);
insert into t select 'leo', private.create_child_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), 'Leo', '🦊', 'sky', true);

-- Mary's history: her own habit and a check-in, a group habit she takes part in (with a check-in),
-- a treat goal. Leo gets a habit too; Anna has her own.
insert into t select 'brush', (private.create_child_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'mary'), 'Brush teeth', '🪥', 2, 'day', null)).id;
select private.check_in_impl((select v from t where k = 'brush'), '00000000-0000-0000-0000-0000000000a1', now(), (select v from t where k = 'mary'));
insert into t select 'walk', (private.create_group_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'),
  'Walk', '🚶', 'fitness', 1, 'day', null, false, array[(select v from t where k = 'mary')], now())).id;
select private.check_in_impl((select v from t where k = 'walk'), '00000000-0000-0000-0000-0000000000a1', now(), (select v from t where k = 'mary'));
select private.set_treat_goal_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'mary'), 'Trip to the park', '🛝', 20);
insert into t select 'leo-bath', (private.create_child_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'leo'), 'Bath time', '🛁', 1, 'day', null)).id;
with h as (insert into public.habits (owner_id, title, category, target_count, period) values ('00000000-0000-0000-0000-0000000000a1', 'Read', 'learning', 1, 'day') returning id)
  insert into t select 'anna-read', id from h;

-- The setup really has history to clear (so the "gone" checks below mean something).
select results_eq($$select (select count(*)::int from public.habits where owner_id = (select v from t where k = 'mary')),
                          (select count(*)::int from public.check_ins where user_id = (select v from t where k = 'mary')),
                          (select count(*)::int from public.group_habit_participants where profile_id = (select v from t where k = 'mary')),
                          (select count(*)::int from public.treat_goals where child_id = (select v from t where k = 'mary')),
                          (select count(*)::int from public.notifications where subject_id = (select v from t where k = 'mary')) > 0$$,
  $$values (1, 2, 1, 1, true)$$, 'before: one habit, two check-ins, one group habit, a goal, and feed items');

-- Who may reset
select throws_ok($$select private.reset_child_impl('00000000-0000-0000-0000-0000000000b1', (select v from t where k = 'mary'))$$,
  'P0001', 'keepup:not_admin', 'a member who is not an admin cannot reset a child');
select throws_ok($$select private.reset_child_impl('00000000-0000-0000-0000-0000000000c1', (select v from t where k = 'mary'))$$,
  'P0002', 'keepup:child_not_found', 'an outsider cannot see the child');
select ok(not has_function_privilege('anon', 'public.reset_child(uuid)', 'execute'), 'signed-out visitors cannot call reset_child');

select lives_ok($$select private.reset_child_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'mary'))$$,
  'an admin resets the child');

-- What stays
select results_eq($$select display_name, avatar_emoji, avatar_color, kind, group_id from public.profiles where id = (select v from t where k = 'mary')$$,
  $$select 'Mary'::text, '🐼'::text, 'sage'::text, 'child'::text, (select v from t where k = 'fam')$$,
  'the nickname, avatar, and her group stay');

-- What's cleared
select is((select count(*)::int from public.habits where owner_id = (select v from t where k = 'mary')), 0, 'her habits are gone');
select is((select count(*)::int from public.check_ins where user_id = (select v from t where k = 'mary')), 0, 'all her check-ins are gone, group ones too');
select is((select count(*)::int from public.group_habit_participants where profile_id = (select v from t where k = 'mary')), 0,
  'she no longer takes part in group habits');
select is((select count(*)::int from public.treat_goals where child_id = (select v from t where k = 'mary')), 0, 'her treat goals are gone');
select is((select count(*)::int from public.notifications where subject_id = (select v from t where k = 'mary')), 0, 'the feed about her is gone');
select is((private.child_rewards_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'mary'), now()) ->> 'stars_this_week')::int, 0,
  'her stars start over');

-- What isn't touched
select is((select count(*)::int from public.habits where id = (select v from t where k = 'walk')), 1, 'the group habit itself stays');
select is((select count(*)::int from public.habits where id in ((select v from t where k = 'leo-bath'), (select v from t where k = 'anna-read'))), 2,
  'her sibling''s and the adults'' habits stay');
select is((select count(*)::int from public.profiles where id = (select v from t where k = 'leo')), 1, 'her sibling is untouched');

select * from finish();
rollback;
