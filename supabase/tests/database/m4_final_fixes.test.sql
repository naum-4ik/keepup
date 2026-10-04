-- supabase/tests/database/m4_final_fixes.test.sql
-- M4 final review: kid moments and "streak is back" skip the person who acted; a group check-in is
-- silenced only by a pushed "Everyone did it" for its own period.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');
select tests.create_user('00000000-0000-0000-0000-0000000000c1', 'grandma@example.com', '{"full_name":"Grandma"}');
update public.profiles set timezone = 'Europe/Rome'
 where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1');

create temp table t (k text primary key, v uuid) on commit drop;
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Family', 'family')).id;
update public.groups set timezone = 'Europe/Rome' where id = (select v from t where k = 'fam');
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000b1',
  (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), now())).token, now());
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000c1',
  (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), now())).token, now());
update public.group_members set joined_at = '2026-09-01' where group_id = (select v from t where k = 'fam');

-- The adult who made a tap: auth.uid() in the database (the public wrappers run as that person).
create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', case when p_user is null then '' else json_build_object('sub', p_user)::text end, true);
$$;

-- I1: a kid's big moments skip the adult who made the tap.
insert into t select 'mary', private.create_child_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), 'Mary', '🐼', 'peach', true);
insert into t select 'water', (private.create_child_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'mary'), 'Drink water', '💧', 20, 'day', null)).id;
insert into t select 'goal', (private.set_treat_goal_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'mary'), 'Trip to the park', '🛝', 1)).id;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select private.check_in_impl((select v from t where k = 'water'), '00000000-0000-0000-0000-0000000000a1', now(), (select v from t where k = 'mary'));
select is((select count(*)::int from public.notifications where kind = 'kid_goal_reached' and user_id = '00000000-0000-0000-0000-0000000000a1'),
  0, 'the adult who tapped the goal in gets no "reached a goal" row');
select is((select count(*)::int from public.notifications where kind = 'kid_goal_reached' and user_id <> '00000000-0000-0000-0000-0000000000a1'),
  2, 'the other adults do');

do $$
begin
  for i in 1..17 loop
    perform private.check_in_impl((select v from t where k = 'water'), '00000000-0000-0000-0000-0000000000a1', now(), (select v from t where k = 'mary'));
  end loop;
end $$;
select is((select count(*)::int from public.notifications where kind = 'kid_garden_full' and user_id = '00000000-0000-0000-0000-0000000000a1'),
  0, 'the adult who filled the garden gets no "full bloom" row');
select is((select count(*)::int from public.notifications where kind = 'kid_garden_full' and user_id = '00000000-0000-0000-0000-0000000000b1'),
  1, 'another adult does');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select private.check_in_impl((select v from t where k = 'water'), '00000000-0000-0000-0000-0000000000b1', now(), (select v from t where k = 'mary'));
select is((select count(*)::int from public.notifications where kind = 'kid_garden_full' and user_id = '00000000-0000-0000-0000-0000000000a1'),
  0, 'a later star from someone else does not send it to the adult left out');

select pg_temp.act_as(null);
select ok(auth.uid() is null, 'setup: no signed-in user (a job)');
insert into t select 'leo', private.create_child_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), 'Leo', '🦊', 'peach', true);
insert into t select 'brush', (private.create_child_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'leo'), 'Brush teeth', '🪥', 20, 'day', null)).id;
insert into t select 'goal2', (private.set_treat_goal_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'leo'), 'Ice cream', '🍦', 1)).id;
select private.check_in_impl((select v from t where k = 'brush'), '00000000-0000-0000-0000-0000000000a1', now(), (select v from t where k = 'leo'));
select is((select count(*)::int from public.notifications where kind = 'kid_goal_reached' and subject_id = (select v from t where k = 'leo')),
  3, 'with no signed-in user every adult hears it');

-- I2: "streak is back" follows only an "ended" that pushed, and skips the person who tapped.
-- Walk (streak of 2 on 3 Oct) and Dinner (3): group habits, no approval, daily. On 4 Oct Dan and
-- Grandma checked in, Anna didn't; the day closes as missed. Anna's or Dan's tap arrives late.
set local session_replication_role = replica;
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, requires_approval, created_at, created_by) values
  ('00000000-0000-0000-0000-0000000000e2', null, (select v from t where k = 'fam'), 'Walk', 'fitness', '🚶', 1, 'day', '2026-10-02', 1, false, '2026-10-01 08:00+02', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000e3', null, (select v from t where k = 'fam'), 'Dinner', 'people', '🍽️', 1, 'day', '2026-10-01', 1, false, '2026-10-01 08:00+02', '00000000-0000-0000-0000-0000000000a1');
insert into public.period_results (habit_id, period_start, outcome) values
  ('00000000-0000-0000-0000-0000000000e2', '2026-10-02', 'done'),
  ('00000000-0000-0000-0000-0000000000e2', '2026-10-03', 'done'),
  ('00000000-0000-0000-0000-0000000000e3', '2026-10-01', 'done'),
  ('00000000-0000-0000-0000-0000000000e3', '2026-10-02', 'done'),
  ('00000000-0000-0000-0000-0000000000e3', '2026-10-03', 'done');
insert into public.check_ins (habit_id, user_id, local_date, period_start, status, created_at, logged_by)
select h, u, '2026-10-04', '2026-10-04', 'approved', '2026-10-04 18:00+02', u
  from unnest(array['00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e3']::uuid[]) h
 cross join unnest(array['00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1']::uuid[]) u;
-- Dinner on 4 Oct: Dan's is the late one this time, Anna's was on time.
update public.check_ins set user_id = '00000000-0000-0000-0000-0000000000a1', logged_by = '00000000-0000-0000-0000-0000000000a1'
 where habit_id = '00000000-0000-0000-0000-0000000000e3' and user_id = '00000000-0000-0000-0000-0000000000b1';
set local session_replication_role = origin;
select private.finalize_periods('2026-10-05 12:30+02');
select is((select array_agg(distinct payload ->> 'streak' order by payload ->> 'streak') from public.notifications
            where kind = 'group_streak_ended' and habit_id in ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e3')),
  array['2', '3'], 'setup: both closed 4 Oct as missed, Walk ended at 2 and Dinner at 3');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select private.check_in_impl('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a1', '2026-10-05 13:00+02', null, false,
  'c0000000-0000-0000-0000-0000000000e2', '2026-10-04 20:00+02');
select is((select outcome from public.period_results where habit_id = '00000000-0000-0000-0000-0000000000e2' and period_start = '2026-10-04'),
  'done', 'a late tap brings Walk''s 4 Oct back');
select is((select count(*)::int from public.notifications where kind = 'streak_back' and habit_id = '00000000-0000-0000-0000-0000000000e2'),
  0, 'a 2-day streak never pushed its end, so no "streak is back" row at all');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select private.check_in_impl('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000b1', '2026-10-05 13:00+02', null, false,
  'c0000000-0000-0000-0000-0000000000e3', '2026-10-04 20:00+02');
select is((select count(*)::int from public.notifications where kind = 'streak_back' and habit_id = '00000000-0000-0000-0000-0000000000e3'
            and user_id = '00000000-0000-0000-0000-0000000000b1'),
  0, 'Dan, whose late tap brought Dinner''s streak back, gets no row');
select is((select count(*)::int from public.notifications where kind = 'streak_back' and habit_id = '00000000-0000-0000-0000-0000000000e3' and push),
  2, 'Anna and Grandma hear it, and it pushes');

-- M3: Dinner's 4 Oct "Everyone did it" was late (feed only). Today Anna checks in: Dan and Grandma's
-- group_check_in is a normal job, not silenced by yesterday's row.
select ok((select bool_and(not push) and count(*) = 3 from public.notifications
            where kind = 'everyone_done' and habit_id = '00000000-0000-0000-0000-0000000000e3' and payload ->> 'period_start' = '2026-10-04'),
  'setup: 4 Oct''s Everyone did it is late and feed only');
select private.check_in_impl('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000a1', '2026-10-05 13:05+02');
insert into t select 'today', id from public.notifications
 where kind = 'group_check_in' and habit_id = '00000000-0000-0000-0000-0000000000e3' and user_id = '00000000-0000-0000-0000-0000000000b1'
   and check_in_id = (select id from public.check_ins where habit_id = '00000000-0000-0000-0000-0000000000e3'
                       and user_id = '00000000-0000-0000-0000-0000000000a1' and local_date = '2026-10-05');
select ok((select push from public.notifications where id = (select v from t where k = 'today')), 'setup: today''s check-in pushes to Dan');
select isnt(public.push_job((select v from t where k = 'today'), now()), null,
  'yesterday''s late Everyone did it does not silence today''s group check-in');

-- A pushed "Everyone did it" from another period doesn't either.
insert into public.notifications (user_id, kind, group_id, habit_id, payload, dedupe_key)
values ('00000000-0000-0000-0000-0000000000b1', 'everyone_done', (select v from t where k = 'fam'), '00000000-0000-0000-0000-0000000000e3',
        jsonb_build_object('period_start', '2026-10-03'::date), 'everyone_done:test:2026-10-03:b1');
select ok((select push from public.notifications where dedupe_key = 'everyone_done:test:2026-10-03:b1'), 'setup: that one pushed');
select isnt(public.push_job((select v from t where k = 'today'), now()), null,
  'a pushed Everyone did it for another day does not silence it');

-- Dan and Grandma finish today: today's pushed Everyone did it still supersedes the check-in.
select private.check_in_impl('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000b1', '2026-10-05 13:10+02');
select private.check_in_impl('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000c1', '2026-10-05 13:10+02');
select is(public.push_job((select v from t where k = 'today'), now()), null, 'today''s pushed Everyone did it still supersedes it');

select * from finish();
rollback;
