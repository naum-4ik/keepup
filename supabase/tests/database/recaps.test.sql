begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');
select tests.create_user('00000000-0000-0000-0000-0000000000e1', 'eve@example.com', '{"full_name":"Eve"}');
update public.profiles set timezone = 'Europe/Rome', week_start = 1, created_at = '2026-09-01'
 where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1');
create temp table t (k text primary key, v uuid) on commit drop;
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Family', 'family')).id;
insert into t select 'inv', (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), now())).id;
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000b1', (select token from public.group_invites where id = (select v from t where k = 'inv')), now());
update public.group_members set joined_at = '2026-09-01' where group_id = (select v from t where k = 'fam');
insert into t select 'friends', (private.create_group_impl('00000000-0000-0000-0000-0000000000e1', 'Friends', 'friends')).id;

set local session_replication_role = replica;
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, requires_approval, created_at, created_by) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', null, 'Read', 'learning', '📚', 1, 'day', '2026-09-28', 1, false, '2026-09-28 08:00+02', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a1', null, 'Gym', 'fitness', '🏋️', 3, 'week', '2026-09-21', 1, false, '2026-09-21 08:00+02', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a1', null, 'Budget', 'work_money', '💼', 1, 'month', '2026-09-01', 1, false, '2026-09-01 08:00+02', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', null, 'Stretch', 'fitness', '🧘', 1, 'day', '2026-09-21', 1, false, '2026-09-21 08:00+02', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000d4', null, (select v from t where k = 'fam'), 'Dinner', 'people', '🍝', 1, 'week', '2026-09-28', 1, false, '2026-09-28 08:00+02', '00000000-0000-0000-0000-0000000000a1');
set local session_replication_role = origin;

-- Read every day of the week of 28 Sep, Gym twice (of 3), Budget once in September, Dinner once.
select private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', (d::date + time '09:00') at time zone 'Europe/Rome')
  from generate_series('2026-09-28'::timestamp, '2026-10-04', '1 day') d;
select private.check_in_impl('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a1', d)
  from unnest(array['2026-09-29 18:00+02', '2026-09-30 18:00+02']::timestamptz[]) d;
select private.check_in_impl('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a1', '2026-09-15 09:00+02');
select private.check_in_impl('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000a1', '2026-09-30 20:00+02');

-- The weekly recap: Read 7/7, Gym 2/3, Dinner 1/1 (Budget is monthly: not in a week).
create temp table w as select private.recap_impl('00000000-0000-0000-0000-0000000000a1', 'week', '2026-09-28', '2026-10-05 10:00+02') as r;
select is((select (r ->> 'done') || ' of ' || (r ->> 'possible') from w), '10 of 11', 'a week: check-ins against targets');
select is((select r -> 'longest' ->> 'title' || ' ' || (r -> 'longest' ->> 'length') from w), 'Read 7', 'the longest streak as the week ended');

-- The monthly recap for September: Read 3/3 (28–30), Gym 2/3 (its week starts in September), Budget 1/1, Dinner 1/1.
create temp table m as select private.recap_impl('00000000-0000-0000-0000-0000000000a1', 'month', '2026-09-01', '2026-10-01 10:00+02') as r;
select is((select (r ->> 'done') || ' of ' || (r ->> 'possible') from m), '7 of 8', 'a month: every habit, monthly ones included');
select ok((select r -> 'badges' @> '[{"code": "first_step"}]' from m), 'badges earned that month are listed');
select is((select jsonb_array_length(r -> 'days') from m), 3, 'a day per daily-habit day, for the heatmap');

-- The 10:00 job: weekly on the first day of the person's week, monthly on the 1st, once.
select private.enqueue_recaps('2026-10-05 09:55+02');
select is((select count(*)::int from public.notifications where kind = 'weekly_recap' and user_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1')), 0, 'nothing before 10:00');
select private.enqueue_recaps('2026-10-05 10:05+02');
select is((select payload ->> 'done' from public.notifications where kind = 'weekly_recap' and user_id = '00000000-0000-0000-0000-0000000000a1'), '10',
  'Monday 10:05: the weekly recap is in Anna''s Inbox');
select ok((select not push from public.notifications where kind = 'weekly_recap' and user_id = '00000000-0000-0000-0000-0000000000a1'),
  'Inbox only by default (Achievements)');
select is(private.enqueue_recaps('2026-10-05 10:20+02'), 0, 'the next tick writes nothing new');
select is((select count(*)::int from public.notifications where kind in ('weekly_recap', 'monthly_recap') and user_id = '00000000-0000-0000-0000-0000000000e1'), 0,
  'nothing due, no recap (wins only)');
select private.enqueue_recaps('2026-10-01 10:05+02');
select is((select payload ->> 'start' from public.notifications where kind = 'monthly_recap' and user_id = '00000000-0000-0000-0000-0000000000a1'), '2026-09-01',
  'the 1st at 10:05: last month''s recap');

-- The family recap's push: one row per adult, Group updates.
select is((select count(*)::int from public.notifications where kind = 'family_recap' and group_id = (select v from t where k = 'fam') and payload ->> 'check_ins' = '1'), 2, 'each adult gets the family recap');
select is((select distinct category from public.notifications where kind = 'family_recap' and group_id = (select v from t where k = 'fam')), 'group_updates', 'under Group updates');

-- History for Progress → Recaps: the last completed weeks, never before the account existed.
select is((select count(*)::int from private.recaps_impl('00000000-0000-0000-0000-0000000000a1', 'week', 8, '2026-10-07 12:00+02')), 5,
  'weeks back to the one the account started in');
select is((select r ->> 'start' from private.recaps_impl('00000000-0000-0000-0000-0000000000a1', 'week', 1, '2026-10-07 12:00+02') r), '2026-09-28', 'newest first');
select throws_ok($$select private.recap_impl('00000000-0000-0000-0000-0000000000a1', 'year', '2026-01-01', now())$$, 'P0001', 'keepup:invalid_choice', 'week or month only');


-- Wins only: Dan had Stretch due every day and did none, so no row; but he is marked processed, so
-- the rest of the day's ticks don't compute him again.
select is((select (r ->> 'done') || ' of ' || (r ->> 'possible') from private.recap_impl('00000000-0000-0000-0000-0000000000b1', 'week', '2026-09-28', '2026-10-05 10:00+02') r)
          || ', rows ' || (select count(*) from public.notifications where kind = 'weekly_recap' and user_id = '00000000-0000-0000-0000-0000000000b1'),
  '0 of 7, rows 0', 'something due and nothing done: no recap row');
select is((select count(*)::int from public.recap_runs where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'weekly_recap' and period_start = '2026-09-28'), 1,
  'processed anyway: marked once');
select is((select count(*)::int from public.notifications where kind = 'family_recap' and group_id = (select v from t where k = 'friends')), 0,
  'a group with no check-ins gets no family recap');

-- The streaks stand as the range ended: a check-in on Monday morning doesn't lengthen last week's.
select private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '2026-10-05 08:00+02');
select is((select r -> 'longest' ->> 'length' from private.recap_impl('00000000-0000-0000-0000-0000000000a1', 'week', '2026-09-28', '2026-10-05 10:00+02') r),
  '7', 'a check-in after the week ended isn''t in its streak');

-- A rested day keeps the streak but isn't due: left out of done and possible, counted as rested.
set local session_replication_role = replica;
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, requires_approval, created_at, created_by) values
  ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000a1', null, 'Walk', 'fitness', '🚶', 1, 'day', '2026-10-01', 1, false, '2026-10-01 08:00+02', '00000000-0000-0000-0000-0000000000a1');
set local session_replication_role = origin;
select private.check_in_impl('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000a1', d)
  from unnest(array['2026-10-01 09:00+02', '2026-10-02 09:00+02', '2026-10-04 09:00+02']::timestamptz[]) d;
set local session_replication_role = replica;
insert into public.period_results (habit_id, period_start, outcome, finalized_at) values
  ('00000000-0000-0000-0000-0000000000d5', '2026-10-01', 'done', '2026-10-02 00:15+02'),
  ('00000000-0000-0000-0000-0000000000d5', '2026-10-02', 'done', '2026-10-03 00:15+02'),
  ('00000000-0000-0000-0000-0000000000d5', '2026-10-03', 'rested', '2026-10-04 00:15+02');
set local session_replication_role = origin;
create temp table rw as select private.recap_impl('00000000-0000-0000-0000-0000000000a1', 'week', '2026-09-28', '2026-10-05 10:00+02') as r;
select is((select (r ->> 'done') || ' of ' || (r ->> 'possible') || ', rested ' || (r ->> 'rested') from rw), '13 of 14, rested 1',
  'a rested day is neither done nor possible');
select is((select d ->> 'possible' || ' ' || (d ->> 'rested') from rw, jsonb_array_elements(r -> 'days') d where d ->> 'date' = '2026-10-03'), '1 1',
  'the heatmap day shows Read due and Walk rested');
select is((select t ->> 'length' from rw, jsonb_array_elements(r -> 'top') t where t ->> 'title' = 'Walk'), '3',
  'the rested day keeps Walk''s streak (done, done, rested, done)');

select is((select schedule from cron.job where jobname = 'keepup-recaps'), '*/15 * * * *', 'the job runs every 15 minutes');

-- Eve: an ended habit, and two weekly habits started on a Wednesday (a short first week).
set local session_replication_role = replica;
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, ends_on, week_start, requires_approval, created_at, created_by) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1', null, 'Yoga', 'fitness', '🧘', 1, 'day', '2026-09-14', '2026-09-20', 1, false, '2026-09-14 08:00+02', '00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000e1', null, 'Swim', 'fitness', '🏊', 2, 'week', '2026-09-30', null, 1, false, '2026-09-30 08:00+02', '00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000e1', null, 'Run', 'fitness', '🏃', 1, 'week', '2026-09-30', null, 1, false, '2026-09-30 08:00+02', '00000000-0000-0000-0000-0000000000e1');
set local session_replication_role = origin;
select private.check_in_impl('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1', (d::date + time '09:00') at time zone 'Europe/Rome')
  from generate_series('2026-09-14'::timestamp, '2026-09-20', '1 day') d;
select private.check_in_impl('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000e1', '2026-10-01 09:00+02');
select private.check_in_impl('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000e1', '2026-10-01 09:00+02');
select is((select string_agg(x ->> 'title', ',') from private.recap_impl('00000000-0000-0000-0000-0000000000e1', 'week', '2026-09-14', '2026-09-21 10:00+02') r, jsonb_array_elements(r -> 'top') x),
  'Yoga', 'a habit that ends in the range still shows its streak');
create temp table ew as select private.recap_impl('00000000-0000-0000-0000-0000000000e1', 'week', '2026-09-28', '2026-10-05 10:00+02') as r;
select is((select string_agg(x ->> 'title', ',') from ew, jsonb_array_elements(r -> 'top') x), 'Run',
  'an ended habit is left out of top once it ended before the range');
select is((select (r ->> 'done') || ' of ' || (r ->> 'possible') from ew), '1 of 1',
  'a short first week counts only when its target was reached (Run 1/1; Swim 1/2 left out)');

-- A group habit: only your own check-ins count toward your part (Dan's two aren't Anna's).
create temp table before_walk as select private.recap_impl('00000000-0000-0000-0000-0000000000a1', 'week', '2026-09-28', '2026-10-05 10:00+02') as r;
set local session_replication_role = replica;
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, requires_approval, created_at, created_by) values
  ('00000000-0000-0000-0000-0000000000d6', null, (select v from t where k = 'fam'), 'Walk together', 'people', '🚶', 2, 'week', '2026-09-21', 1, false, '2026-09-21 08:00+02', '00000000-0000-0000-0000-0000000000a1');
set local session_replication_role = origin;
select private.check_in_impl('00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000b1', d)
  from unnest(array['2026-09-29 19:00+02', '2026-09-30 19:00+02']::timestamptz[]) d;
select private.check_in_impl('00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000a1', '2026-10-01 19:00+02');
select is((select ((a.r ->> 'done')::int - (b.r ->> 'done')::int) || ' of ' || ((a.r ->> 'possible')::int - (b.r ->> 'possible')::int)
             from before_walk b, (select private.recap_impl('00000000-0000-0000-0000-0000000000a1', 'week', '2026-09-28', '2026-10-05 10:00+02') as r) a),
  '1 of 2', 'Dan''s check-ins don''t count toward Anna''s part');

-- Catch-up, and a person whose row fails (a time zone Postgres can't read) doesn't stop the others.
select tests.create_user('00000000-0000-0000-0000-000000000001', 'broken@example.com', '{"full_name":"Broken"}');
alter table public.profiles drop constraint profiles_timezone_check;
set local session_replication_role = replica;
update public.profiles set timezone = 'Nowhere/Land' where id = '00000000-0000-0000-0000-000000000001';
set local session_replication_role = origin;
select private.enqueue_recaps('2026-10-12 14:00+02');
select is(private.enqueue_recaps('2026-10-12 14:15+02'), 0, 'the next tick writes nothing new');
select is((select count(*)::int from public.notifications where kind = 'weekly_recap' and user_id = '00000000-0000-0000-0000-0000000000a1' and payload ->> 'start' = '2026-10-05'), 1,
  'the 10:00 tick was missed: the 14:00 one writes the recap, once');
select is((select count(*)::int from public.recap_runs where user_id = '00000000-0000-0000-0000-000000000001'), 0,
  'the failing person is skipped, unmarked (retried next tick), and the others still get theirs');

-- Progress → Recaps, as the person.
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.recaps('week', 2)), 2, 'recaps() for the signed-in person');
select throws_ok($$select * from public.recaps('year')$$, 'P0001', 'keepup:invalid_choice', 'recaps(): week or month only');
reset role;

select * from finish();
rollback;
