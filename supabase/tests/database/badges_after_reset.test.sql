-- supabase/tests/database/badges_after_reset.test.sql
-- Badges start fresh after Reset my data (owner 2026-10-07): history the reset keeps (group
-- check-ins and periods, cheers, approvals) no longer counts toward a badge; only what comes after
-- the reset does (private.after_reset).
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

delete from public.habits;
select tests.create_user('00000000-0000-0000-0000-0000000003a1', 'fresh-anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000003b1', 'fresh-dan@example.com', '{"full_name":"Dan"}');
update public.profiles set timezone = 'Europe/Rome', week_start = 1
 where id in ('00000000-0000-0000-0000-0000000003a1', '00000000-0000-0000-0000-0000000003b1');

create temp table t (k text primary key, v uuid) on commit drop;
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000003a1', 'Family', 'family')).id;
select private.accept_invite_impl('00000000-0000-0000-0000-0000000003b1',
  (private.create_invite_impl('00000000-0000-0000-0000-0000000003a1', (select v from t where k = 'fam'), now())).token, now());
update public.groups set timezone = 'Europe/Rome', week_start = 1 where id = (select v from t where k = 'fam');
update public.group_members set joined_at = '2026-03-01' where group_id = (select v from t where k = 'fam');

-- Group habits from 1 April: Walk (fitness), Tidy (home, needs approval), Run (fitness, up to 50 a day).
set local session_replication_role = replica;
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, requires_approval, created_at, created_by) values
  ('00000000-0000-0000-0000-0000000003d1', null, (select v from t where k = 'fam'), 'Walk', 'fitness', '🚶', 1, 'day', '2026-04-01', 1, false, '2026-04-01 08:00+02', '00000000-0000-0000-0000-0000000003a1'),
  ('00000000-0000-0000-0000-0000000003d2', null, (select v from t where k = 'fam'), 'Tidy', 'home', '🧹', 1, 'day', '2026-04-01', 1, true, '2026-04-01 08:00+02', '00000000-0000-0000-0000-0000000003a1'),
  ('00000000-0000-0000-0000-0000000003d3', null, (select v from t where k = 'fam'), 'Run', 'fitness', '🏃', 50, 'day', '2026-04-01', 1, false, '2026-04-01 08:00+02', '00000000-0000-0000-0000-0000000003a1');
-- Before the reset: Anna walked every day 1 Apr – 9 Jun (70 check-ins: enough for Mover, a long
-- streak, many done group periods), approved 25 of Dan's Tidy check-ins and cheered 21 of his walks.
insert into public.check_ins (habit_id, user_id, local_date, period_start, status, created_at)
select '00000000-0000-0000-0000-0000000003d1', '00000000-0000-0000-0000-0000000003a1', d::date, d::date, 'approved', d + interval '9 hours'
  from generate_series('2026-04-01'::timestamp, '2026-06-09', interval '1 day') d;
insert into public.period_results (habit_id, period_start, outcome, finalized_at)
select '00000000-0000-0000-0000-0000000003d1', d::date, 'done', d + interval '25 hours'
  from generate_series('2026-04-01'::timestamp, '2026-06-09', interval '1 day') d;
insert into public.check_ins (habit_id, user_id, local_date, period_start, status, created_at, reviewed_by, reviewed_at)
select '00000000-0000-0000-0000-0000000003d2', '00000000-0000-0000-0000-0000000003b1', d::date, d::date, 'approved', d + interval '9 hours',
       '00000000-0000-0000-0000-0000000003a1', d + interval '12 hours'
  from generate_series('2026-05-01'::timestamp, '2026-05-25', interval '1 day') d;
with w as (
  insert into public.check_ins (habit_id, user_id, local_date, period_start, status, created_at)
  select '00000000-0000-0000-0000-0000000003d1', '00000000-0000-0000-0000-0000000003b1', d::date, d::date, 'approved', d + interval '10 hours'
    from generate_series('2026-05-01'::timestamp, '2026-05-21', interval '1 day') d
  returning id, created_at)
insert into public.cheers (check_in_id, user_id, created_at) select w.id, '00000000-0000-0000-0000-0000000003a1', w.created_at + interval '1 hour' from w;
set local session_replication_role = origin;

create function pg_temp.has(p_code text) returns boolean language sql as $$
  select exists (select 1 from public.user_achievements where user_id = '00000000-0000-0000-0000-0000000003a1' and achievement_code = p_code)
$$;
create function pg_temp.settle(p_day date) returns void language sql as $$
  insert into public.period_results (habit_id, period_start, outcome, finalized_at)
  values ('00000000-0000-0000-0000-0000000003d1', p_day, 'done', private.local_midnight(p_day + 1, 'Europe/Rome') + interval '1 hour')
$$;
create function pg_temp.walk(p_user uuid, p_day date) returns uuid language sql as $$
  select (private.check_in_impl('00000000-0000-0000-0000-0000000003d1', p_user, private.local_midnight(p_day, 'Europe/Rome') + interval '9 hours')).id
$$;

-- Reset on Wed 10 June, 10:00 in Rome.
select private.reset_my_data_impl('00000000-0000-0000-0000-0000000003a1', '2026-06-10 10:00+02');
select is((select data_reset_at from public.profiles where id = '00000000-0000-0000-0000-0000000003a1'), '2026-06-10 10:00+02'::timestamptz,
  'the reset is stamped on the profile');

-- One more of each, after the reset: none brings back a badge from the old history.
select pg_temp.walk('00000000-0000-0000-0000-0000000003b1', '2026-06-10');
select private.check_in_impl('00000000-0000-0000-0000-0000000003d1', '00000000-0000-0000-0000-0000000003a1', '2026-06-10 12:00+02');
insert into public.cheers (check_in_id, user_id, created_at)
select c.id, '00000000-0000-0000-0000-0000000003a1', '2026-06-10 13:00+02' from public.check_ins c
 where c.habit_id = '00000000-0000-0000-0000-0000000003d1' and c.user_id = '00000000-0000-0000-0000-0000000003b1' and c.local_date = '2026-06-10';
insert into t select 'tidy1', (private.check_in_impl('00000000-0000-0000-0000-0000000003d2', '00000000-0000-0000-0000-0000000003b1', '2026-06-10 11:30+02')).id;
select private.review_check_in_impl((select v from t where k = 'tidy1'), '00000000-0000-0000-0000-0000000003a1', true, '2026-06-10 14:00+02');
select pg_temp.settle('2026-06-10'); -- this day began before the reset

select is((select array_agg(achievement_code order by achievement_code) from public.user_achievements where user_id = '00000000-0000-0000-0000-0000000003a1'),
  array['first_step'], 'after the reset, one more check-in, cheer, approval and group settle: only First step (the first check-in since)');
select ok(not pg_temp.has('mover') and not pg_temp.has('cheerleader') and not pg_temp.has('fair_judge'),
  'Mover (70 old walks), Cheerleader (21 old cheers) and Fair judge (25 old approvals) don''t come back');
select ok(not pg_temp.has('all_together') and not pg_temp.has('first_week') and not pg_temp.has('two_weeks_strong') and not pg_temp.has('back_on_track'),
  'All together and the streak badges don''t come back from the old run (a day that began before the reset)');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000003a1' and kind = 'badge_unlocked'
            and payload ->> 'code' <> 'first_step'), 0, 'and no Inbox badge row for any of them');
select ok(exists (select 1 from public.user_achievements where user_id = '00000000-0000-0000-0000-0000000003b1' and achievement_code = 'all_together'),
  'Dan, who didn''t reset, earns All together at that settle (the settle ran)');

-- Then each threshold again, from the reset on.
-- All together: the first group period that began after the reset.
select pg_temp.walk('00000000-0000-0000-0000-0000000003a1', '2026-06-11');
select pg_temp.settle('2026-06-11');
select ok(pg_temp.has('all_together'), 'All together: the first done group period after the reset');

-- Mover: 50 fitness check-ins since the reset (1 on the 10th, 42 runs, then walks 11–17 June).
set local session_replication_role = replica;
insert into public.check_ins (habit_id, user_id, local_date, period_start, status, created_at)
select '00000000-0000-0000-0000-0000000003d3', '00000000-0000-0000-0000-0000000003a1', '2026-06-10', '2026-06-10', 'approved', '2026-06-10 15:00+02'::timestamptz + i * interval '1 minute'
  from generate_series(1, 42) i;
set local session_replication_role = origin;
select pg_temp.walk('00000000-0000-0000-0000-0000000003a1', d::date), pg_temp.settle(d::date)
  from generate_series('2026-06-12'::timestamp, '2026-06-16', interval '1 day') d;
select ok(not pg_temp.has('mover'), 'not Mover at 49 since the reset');
select ok(not pg_temp.has('first_week'), 'not First week after 6 days since the reset (11–16 June)');
select pg_temp.walk('00000000-0000-0000-0000-0000000003a1', '2026-06-17');
select ok(pg_temp.has('mover'), 'Mover at the 50th fitness check-in since the reset');
select pg_temp.settle('2026-06-17');
select ok(pg_temp.has('first_week'), 'First week: 7 days in a row, all after the reset (11–17 June)');

-- Cheerleader: 20 cheers since the reset (1 on the 10th, then 19).
set local session_replication_role = replica;
insert into public.check_ins (habit_id, user_id, local_date, period_start, status, created_at)
select '00000000-0000-0000-0000-0000000003d3', '00000000-0000-0000-0000-0000000003b1', '2026-06-12', '2026-06-12', 'approved', '2026-06-12 08:00+02'::timestamptz + i * interval '1 minute'
  from generate_series(1, 19) i;
set local session_replication_role = origin;
insert into public.cheers (check_in_id, user_id, created_at)
select c.id, '00000000-0000-0000-0000-0000000003a1', '2026-06-12 12:00+02' from public.check_ins c
 where c.habit_id = '00000000-0000-0000-0000-0000000003d3' and c.user_id = '00000000-0000-0000-0000-0000000003b1' order by c.created_at limit 18;
select ok(not pg_temp.has('cheerleader'), 'not Cheerleader at 19 cheers since the reset');
insert into public.cheers (check_in_id, user_id, created_at)
select c.id, '00000000-0000-0000-0000-0000000003a1', '2026-06-12 12:05+02' from public.check_ins c
 where c.habit_id = '00000000-0000-0000-0000-0000000003d3' and c.user_id = '00000000-0000-0000-0000-0000000003b1'
   and not exists (select 1 from public.cheers x where x.check_in_id = c.id) limit 1;
select ok(pg_temp.has('cheerleader'), 'Cheerleader at the 20th cheer since the reset');

-- Fair judge: 20 approvals since the reset (1 on the 10th, 18 more, then one through the review).
set local session_replication_role = replica;
insert into public.check_ins (habit_id, user_id, local_date, period_start, status, created_at, reviewed_by, reviewed_at)
select '00000000-0000-0000-0000-0000000003d2', '00000000-0000-0000-0000-0000000003b1', '2026-06-11', '2026-06-11', 'approved',
       '2026-06-11 08:00+02'::timestamptz + i * interval '1 minute', '00000000-0000-0000-0000-0000000003a1', '2026-06-11 12:00+02'::timestamptz + i * interval '1 minute'
  from generate_series(1, 18) i;
set local session_replication_role = origin;
select ok(not pg_temp.has('fair_judge'), 'not Fair judge at 19 approvals since the reset');
insert into t select 'tidy2', (private.check_in_impl('00000000-0000-0000-0000-0000000003d2', '00000000-0000-0000-0000-0000000003b1', '2026-06-13 11:00+02')).id;
select private.review_check_in_impl((select v from t where k = 'tidy2'), '00000000-0000-0000-0000-0000000003a1', true, '2026-06-13 12:00+02');
select ok(pg_temp.has('fair_judge'), 'Fair judge at the 20th approval since the reset');

-- Without a reset nothing changes: Dan's old cheers and approvals still count as before.
select ok(private.after_reset('00000000-0000-0000-0000-0000000003b1', '2000-01-01'), 'no reset: everything counts');
select ok(not private.after_reset('00000000-0000-0000-0000-0000000003a1', '2026-06-10 09:59+02')
          and private.after_reset('00000000-0000-0000-0000-0000000003a1', '2026-06-10 10:00+02'), 'after a reset: from its moment on');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'data_reset_at', 'UPDATE'),
  'nobody can move their own reset stamp (and so bring old history back)');

select * from finish();
rollback;
