begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');
update public.profiles set timezone = 'Europe/Rome' where id = '00000000-0000-0000-0000-0000000000a1';

create temp table t (k text primary key, v uuid) on commit drop;
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Family', 'family')).id;
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000b1',
  (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), now())).token, now());
insert into t select 'mary', private.create_child_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), 'Mary', '🐼', 'peach', true);

select results_eq($$select private.garden_stage(n) from unnest(array[0, 2, 3, 6, 7, 11, 12, 17, 18, 40]) n$$,
  $$values (0), (0), (1), (1), (2), (2), (3), (3), (4), (4)$$, 'garden stages at 0/3/7/12/18 stars');

-- A habit that allows many check-ins a day, so one test day can hold many stars.
insert into t select 'water', (private.create_child_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'mary'), 'Drink water', '💧', 20, 'day', null)).id;
insert into t select 'goal', (private.set_treat_goal_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'mary'), 'Trip to the park', '🛝', 5)).id;

do $$
begin
  for i in 1..4 loop
    perform private.check_in_impl((select v from t where k = 'water'), '00000000-0000-0000-0000-0000000000a1', now(), (select v from t where k = 'mary'));
  end loop;
end $$;
select ok((select reached_at is null from public.treat_goals where id = (select v from t where k = 'goal')), 'four of five stars: not reached');
select private.check_in_impl((select v from t where k = 'water'), '00000000-0000-0000-0000-0000000000a1', now(), (select v from t where k = 'mary'), true);
select ok((select reached_at is not null from public.treat_goals where id = (select v from t where k = 'goal')), 'the fifth star reaches the goal');
select is((select count(*)::int from public.notifications where group_id = (select v from t where k = 'fam') and kind = 'kid_goal_reached'), 2, 'both adults hear it');
select is((select payload ->> 'title' from public.notifications where group_id = (select v from t where k = 'fam') and kind = 'kid_goal_reached' limit 1), 'Trip to the park', 'with the treat''s title');
select lives_ok($$select private.mark_treat_received_impl('00000000-0000-0000-0000-0000000000b1', (select v from t where k = 'goal'))$$, 'a parent marks it received');

-- Full garden: once per week at 18
do $$
begin
  for i in 1..13 loop
    perform private.check_in_impl((select v from t where k = 'water'), '00000000-0000-0000-0000-0000000000a1', now(), (select v from t where k = 'mary'));
  end loop;
end $$;
select is((select count(*)::int from public.notifications where group_id = (select v from t where k = 'fam') and kind = 'kid_garden_full'), 2, '18 stars fill the garden and both adults hear it');
select private.check_in_impl((select v from t where k = 'water'), '00000000-0000-0000-0000-0000000000a1', now(), (select v from t where k = 'mary'));
select is((select count(*)::int from public.notifications where group_id = (select v from t where k = 'fam') and kind = 'kid_garden_full'), 2, 'the 19th star does not repeat it');

-- The rewards summary
select is((private.child_rewards_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'mary'), now()) ->> 'stars_this_week')::int,
  19, 'stars this week');
select is((private.child_rewards_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'mary'), now()) ->> 'stage')::int,
  4, 'a full garden');
select is(private.child_rewards_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'mary'), now()) -> 'goal',
  'null'::jsonb, 'no active goal after it was received');
select throws_ok($$select private.child_rewards_impl('00000000-0000-0000-0000-0000000000c1', (select v from t where k = 'mary'), now())$$,
  'P0002', 'keepup:child_not_found', 'only the child''s adults see her rewards');

-- Family recap: only on the first day of the group's week, for the week that ended
select is_empty($$select * from private.family_recaps_impl('00000000-0000-0000-0000-0000000000a1', '2026-10-07T10:00:00Z')$$,
  'no recap mid-week');
select is((select week_start from private.family_recaps_impl('00000000-0000-0000-0000-0000000000a1', '2026-10-12T10:00:00Z')),
  '2026-10-05'::date, 'on Monday, a recap of last week');

-- Dismissing cards: documented keys only
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$select public.dismiss_card('invite_family')$$, 'a documented key is accepted');
select lives_ok($$select public.dismiss_card('family_recap:00000000-0000-0000-0000-0000000000f1:2026-10-05')$$, 'a recap key is accepted');
select throws_ok($$select public.dismiss_card('whatever')$$, 'P0001', 'keepup:invalid_card', 'an unknown key is refused');
select throws_ok($$select public.dismiss_card('add_child:not-a-uuid')$$, 'P0001', 'keepup:invalid_card', 'a malformed key is refused');
reset role;

select * from finish();
rollback;
