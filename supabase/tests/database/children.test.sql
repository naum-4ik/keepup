begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');
select tests.create_user('00000000-0000-0000-0000-0000000000c1', 'carol@example.com', '{"full_name":"Carol"}');

create temp table t (k text primary key, v uuid) on commit drop;

-- Family (Anna admin, Dan member) and Grandparents (Anna admin only)
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Family', 'family')).id;
insert into t select 'gp', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Grandparents', 'family')).id;
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000b1',
  (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), now())).token, now());

-- Adding a child
select throws_ok($$select private.create_child_impl('00000000-0000-0000-0000-0000000000b1', (select v from t where k = 'fam'), 'Mary', '🐼', 'peach', true)$$,
  'P0001', 'keepup:not_admin', 'only an admin adds a child');
select throws_ok($$select private.create_child_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), 'Mary', '🐼', 'peach', false)$$,
  'P0001', 'keepup:guardian_required', 'the parent-or-guardian line must be confirmed');
insert into t select 'mary', private.create_child_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), 'Mary', '🐼', 'peach', true);
select results_eq($$select kind, group_id, display_name, avatar_emoji from public.profiles where id = (select v from t where k = 'mary')$$,
  $$select 'child'::text, (select v from t where k = 'fam'), 'Mary'::text, '🐼'::text$$, 'a child is a profile with a group and no login');
select is((select count(*)::int from auth.users where id = (select v from t where k = 'mary')), 0, 'no auth user exists for a child');
select throws_ok($$insert into public.group_members (group_id, user_id) values ((select v from t where k = 'gp'), (select v from t where k = 'mary'))$$,
  'P0001', 'keepup:not_an_adult', 'a child can never be a group member');

-- Any adult member manages the child
select lives_ok($$select private.update_child_impl('00000000-0000-0000-0000-0000000000b1', (select v from t where k = 'mary'), 'Mary B', null, 'sage')$$,
  'any adult member edits the child''s profile');
insert into t select 'brush', (private.create_child_habit_impl('00000000-0000-0000-0000-0000000000b1', (select v from t where k = 'mary'),
  'Brush teeth', '🪥', 2, 'day', null)).id;
select results_eq($$select category is null, owner_id, week_start from public.habits where id = (select v from t where k = 'brush')$$,
  $$select true, (select v from t where k = 'mary'), (select week_start from public.groups where id = (select v from t where k = 'fam'))$$,
  'a kid habit has no category, belongs to the child and uses the group''s week start');
select throws_ok($$select private.create_child_habit_impl('00000000-0000-0000-0000-0000000000c1', (select v from t where k = 'mary'), 'Bath', '🛁', 1, 'day', null)$$,
  'P0002', 'keepup:child_not_found', 'an outsider cannot add habits for the child');
select throws_ok($$insert into public.habits (owner_id, title, target_count, period) values ('00000000-0000-0000-0000-0000000000a1', 'No category', 1, 'day')$$,
  'P0001', 'keepup:category_required', 'an adult''s habit still needs a category');

-- Checking in for the child: adults other than the author, and the kid view
select lives_ok($$select private.check_in_impl((select v from t where k = 'brush'), '00000000-0000-0000-0000-0000000000a1', now(), (select v from t where k = 'mary'))$$,
  'Anna logs a check-in for Mary');
select lives_ok($$select private.check_in_impl((select v from t where k = 'brush'), '00000000-0000-0000-0000-0000000000b1', now(), (select v from t where k = 'mary'), true)$$,
  'Mary taps in the kid view on Dan''s phone');
select is((select count(*)::int from public.check_ins where habit_id = (select v from t where k = 'brush') and status = 'approved'),
  2, 'child check-ins never pend');
select throws_ok($$select private.check_in_impl((select v from t where k = 'brush'), '00000000-0000-0000-0000-0000000000c1', now(), (select v from t where k = 'mary'))$$,
  'P0002', 'keepup:habit_not_found', 'an outsider cannot log for the child');

-- Summaries for the kid view
select is((select count(*)::int from private.subject_summaries((select v from t where k = 'mary'), now())), 1, 'the child''s summary lists her habits');
select is((select done_count from private.subject_summaries((select v from t where k = 'mary'), now())), 2, 'with her own counts');

-- Treat goals
insert into t select 'goal', (private.set_treat_goal_impl('00000000-0000-0000-0000-0000000000b1', (select v from t where k = 'mary'), 'Trip to the park', '🛝', 20)).id;
select throws_ok($$select private.set_treat_goal_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'mary'), 'Ice cream', '🍦', 5)$$,
  'P0001', 'keepup:goal_exists', 'one active goal per child');
select throws_ok($$select private.mark_treat_received_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'goal'))$$,
  'P0001', 'keepup:goal_not_reached', 'a goal can be marked received only once it is reached');
select lives_ok($$select private.cancel_treat_goal_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'goal'))$$, 'a goal can be cancelled');
select lives_ok($$select private.set_treat_goal_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'mary'), 'Ice cream', '🍦', 5)$$, 'and a new one set');

-- Moving: admins of both groups only; history moves with the child
select throws_ok($$select private.move_child_impl('00000000-0000-0000-0000-0000000000b1', (select v from t where k = 'mary'), (select v from t where k = 'gp'))$$,
  'P0001', 'keepup:not_admin', 'a member cannot move a child');
select lives_ok($$select private.move_child_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'mary'), (select v from t where k = 'gp'))$$,
  'an admin of both groups moves the child');
select results_eq($$select (select count(*)::int from public.check_ins where user_id = (select v from t where k = 'mary')),
                          (select count(*)::int from public.habits where owner_id = (select v from t where k = 'mary')),
                          (select count(*)::int from public.treat_goals where child_id = (select v from t where k = 'mary'))$$,
  $$values (2, 1, 1)$$, 'habits, check-ins and the goal move with her');
select ok(not private.can_act_for('00000000-0000-0000-0000-0000000000b1', (select v from t where k = 'mary')),
  'Dan, not in the new group, no longer manages her');
select throws_ok($$select private.move_child_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'mary'), (select v from t where k = 'gp'))$$,
  'P0001', 'keepup:same_group', 'moving to the group she is in is refused');

-- Leaving removes access
select lives_ok($$select private.move_child_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'mary'), (select v from t where k = 'fam'))$$, 'back to Family');
select lives_ok($$select private.leave_group_impl('00000000-0000-0000-0000-0000000000b1', (select v from t where k = 'fam'), false, now())$$, 'Dan leaves Family');
select ok(not private.can_act_for('00000000-0000-0000-0000-0000000000b1', (select v from t where k = 'mary')), 'leaving the group removes access to the child');

-- Export
select is((private.export_child_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'mary')) -> 'profile' ->> 'name'),
  'Mary B', 'export includes the profile');
select is(jsonb_array_length(private.export_child_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'mary')) -> 'check_ins'),
  2, 'and the check-ins');

-- The last adult leaving, or deleting the group, needs confirmation
select throws_ok($$select private.leave_group_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), false, now())$$,
  'P0001', 'keepup:children_would_be_deleted', 'the last adult is warned before the child is deleted');
select lives_ok($$select private.leave_group_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), true, now())$$,
  'with confirmation the last adult leaves');
select is((select count(*)::int from public.profiles where id = (select v from t where k = 'mary')), 0,
  'and the group and the child are deleted');

select * from finish();
rollback;
