-- supabase/tests/database/milestones.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

delete from public.habits;
select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');
select tests.create_user('00000000-0000-0000-0000-0000000000f1', 'fay@example.com', '{"full_name":"Fay"}');
update public.profiles set timezone = 'Europe/Rome' where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1');

create temp table t (k text primary key, v uuid) on commit drop;
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Family', 'family')).id;
insert into t select 'inv', (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), now())).id;
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000b1', (select token from public.group_invites where id = (select v from t where k = 'inv')), now());
update public.group_members set joined_at = '2026-09-01' where group_id = (select v from t where k = 'fam');
insert into t select 'mary', private.create_child_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), 'Mary', '🐼', 'peach', true);

set local session_replication_role = replica;
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, requires_approval, created_at, created_by) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', null, 'Read', 'learning', '📚', 1, 'day', '2026-10-01', 1, false,
   '2026-10-01 08:00+02', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000d2', null, (select v from t where k = 'fam'), 'Walk', 'fitness', '👟', 1, 'day', '2026-10-01', 1, false,
   '2026-10-01 08:00+02', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000d3', (select v from t where k = 'mary'), null, 'Brush teeth', null, '🪥', 1, 'day', '2026-10-01', 1, false,
   '2026-10-01 08:00+02', '00000000-0000-0000-0000-0000000000a1');
set local session_replication_role = origin;

-- Read: 1–12 Oct done, 13 and 14 Oct missed, 15 Oct done (two missed days: still a break once PR 10's rest
-- days exist, since 12 done days save only one). Walk: both on 1 Oct. Brush teeth: 1–7 Oct.
select private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', (d::date + time '09:00') at time zone 'Europe/Rome')
  from generate_series('2026-10-01'::timestamp, '2026-10-15', '1 day') d where d::date not in ('2026-10-13', '2026-10-14');
select private.check_in_impl('00000000-0000-0000-0000-0000000000d2', u, '2026-10-01 09:00+02')
  from unnest(array['00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1']::uuid[]) u;
select private.check_in_impl('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a1', (d::date + time '19:00') at time zone 'Europe/Rome', (select v from t where k = 'mary'))
  from generate_series('2026-10-01'::timestamp, '2026-10-07', '1 day') d;
select private.finalize_periods('2026-10-16 01:00+02');
create temp view ms as select x.* from public.xp_events x where x.reason = 'milestone';

-- Schedule and bonuses (ideas/achievements-and-rewards.md §2).
select is(array[private.milestone_bonus('day', 7), private.milestone_bonus('day', 365), private.milestone_bonus('week', 4), private.milestone_bonus('month', 3)],
  array[25, 1000, 50, 100], 'bonuses per the table');
select ok(private.milestone_bonus('day', 3) is null, '3 days is not a milestone');

-- Personal milestones, once per streak, keyed by the streak's first day.
select is((select array_agg(split_part(source_id, ':', 3)::int order by split_part(source_id, ':', 3)::int) from ms
            where user_id = '00000000-0000-0000-0000-0000000000a1' and source_id like '00000000-0000-0000-0000-0000000000d1:2026-10-01:%'),
  array[1, 2, 5, 7, 10], 'the first streak reaches 1, 2, 5, 7 and 10');
select is((select sum(amount)::int from ms where source_id like '00000000-0000-0000-0000-0000000000d1:2026-10-01:%'), 60, 'with their bonuses (5+5+10+25+15)');
select is((select array_agg(payload ->> 'streak' || ':' || (payload ->> 'back') order by payload ->> 'streak') from public.notifications
            where kind = 'streak_milestone' and dedupe_key like 'streak_milestone:00000000-0000-0000-0000-0000000000d1:2026-10-15:%'),
  array['1:true'], 'after a break, day 1 counts again, as "back" ("A fresh start")');
select is((select count(*)::int from public.notifications where kind = 'streak_milestone' and user_id = '00000000-0000-0000-0000-0000000000a1'), 6,
  'one Inbox row per milestone');
select ok((select bool_and(not push) from public.notifications where kind = 'streak_milestone'), 'Inbox only by default (Achievements)');

-- Late taps for 13 and 14 Oct (within 3 days) merge the streaks: 14 Oct becomes the 14-day milestone.
select private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '2026-10-16 09:00+02',
  null, false, 'c0000000-0000-0000-0000-0000000000a1', '2026-10-13 21:00+02');
select private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '2026-10-16 09:01+02',
  null, false, 'c0000000-0000-0000-0000-0000000000a2', '2026-10-14 21:00+02');
select is((select amount from ms where source_id = '00000000-0000-0000-0000-0000000000d1:2026-10-01:14'), 40,
  'upgrading a missed day in the middle makes a later day the 14-day milestone');
select is((select payload ->> 'back' from public.notifications where dedupe_key like 'streak_milestone:00000000-0000-0000-0000-0000000000d1:2026-10-01:14:%'), 'false',
  'a first 14, not a "back to"');
select is((select count(*)::int from ms where source_id like '00000000-0000-0000-0000-0000000000d1:2026-10-01:%'), 6, 'and nothing else twice');

-- Re-running and an undo in the open period change nothing settled.
insert into t select 'open', (private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '2026-10-16 10:00+02')).id;
select private.undo_check_in_impl((select v from t where k = 'open'), '00000000-0000-0000-0000-0000000000a1', '2026-10-16 10:05+02');
select private.finalize_periods('2026-10-16 02:00+02');
select is((select count(*)::int from ms where user_id = '00000000-0000-0000-0000-0000000000a1' and habit_id = '00000000-0000-0000-0000-0000000000d1'), 7,
  'an undone check-in can''t re-earn a milestone, re-running finalize grants nothing');

-- Group: the bonus to each required member, one Group updates row per member, once per streak.
select is((select count(*)::int from ms where source_id = '00000000-0000-0000-0000-0000000000d2:2026-10-01:1'), 2, 'each required member gets the group bonus');
select is((select count(*)::int from public.notifications where dedupe_key like 'group_milestone:00000000-0000-0000-0000-0000000000d2:2026-10-01:1:%'), 2,
  'and each adult one group milestone row');

-- A child: XP behind the scenes, the parents get "7 days in a row" (kid_streak), the child no row.
select is((select count(*)::int from public.notifications where kind = 'kid_streak' and payload ->> 'streak' = '7'), 2, 'both parents hear about 7 days');
select is((select count(*)::int from public.notifications where user_id = (select v from t where k = 'mary')), 0, 'the child gets no Inbox row');

-- Backfill: past streaks, quietly, once.
set local session_replication_role = replica;
insert into public.habits (id, owner_id, title, category, emoji, target_count, period, starts_on, week_start, created_at, created_by)
values ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000f1', 'Walk', 'fitness', '👟', 1, 'day', '2026-09-01', 1,
        '2026-09-01 08:00Z', '00000000-0000-0000-0000-0000000000f1');
insert into public.period_results (habit_id, period_start, outcome, finalized_at)
select '00000000-0000-0000-0000-0000000000d4', d::date, 'done', d + interval '1 day' from generate_series('2026-09-01'::timestamp, '2026-09-05', '1 day') d;
set local session_replication_role = origin;
select private.backfill_milestones();
select is((select sum(amount)::int from ms where user_id = '00000000-0000-0000-0000-0000000000f1')
          + (select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000000f1') * 1000
          + private.backfill_milestones() * 1000000, 20, 'backfill: 1, 2 and 5 days (+20), no Inbox rows, and once');

-- Added (PR 7 addendum). The late tap that made 14 Oct the 14-day milestone carries late = true.
select is((select payload ->> 'late' from public.notifications where dedupe_key like 'streak_milestone:00000000-0000-0000-0000-0000000000d1:2026-10-01:14:%'), 'true',
  'a milestone reached by a late tap is marked late (it pushes only per Achievements delivery)');

-- A late upgrade before a streak's first done day moves its start: N is still paid once per streak.
set local session_replication_role = replica;
insert into public.habits (id, owner_id, title, category, emoji, target_count, period, starts_on, week_start, created_at, created_by)
values ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000f1', 'Stretch', 'fitness', '🧘', 1, 'day', '2026-09-10', 1,
        '2026-09-10 08:00Z', '00000000-0000-0000-0000-0000000000f1');
insert into public.period_results (habit_id, period_start, outcome, finalized_at)
values ('00000000-0000-0000-0000-0000000000d5', '2026-09-10', 'skipped', '2026-09-11 01:00Z');
set local session_replication_role = origin;
insert into public.period_results (habit_id, period_start, outcome, finalized_at)
values ('00000000-0000-0000-0000-0000000000d5', '2026-09-11', 'done', '2026-09-12 01:00Z');
update public.period_results set outcome = 'done' where habit_id = '00000000-0000-0000-0000-0000000000d5' and period_start = '2026-09-10';
select is((select array_agg(split_part(source_id, ':', 2) || ':' || split_part(source_id, ':', 3) order by source_id) from ms
            where habit_id = '00000000-0000-0000-0000-0000000000d5'),
  array['2026-09-10:2', '2026-09-11:1'], 'an upgrade that moves the streak''s start pays 2 days, not day 1 again');

-- Group milestones reached by a late upgrade stay in the Inbox (the late rule); on time they push.
select private.set_notification_delivery_impl('00000000-0000-0000-0000-0000000000a1', 'group_updates', 'sound');
set local session_replication_role = replica;
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, requires_approval, created_at, created_by)
select x.id::uuid, null, (select v from t where k = 'fam'), x.title, 'fitness', '🏊', 1, 'day', '2026-10-01', 1, false,
       '2026-10-01 08:00+02', '00000000-0000-0000-0000-0000000000a1'
  from (values ('00000000-0000-0000-0000-0000000000d6', 'Swim'), ('00000000-0000-0000-0000-0000000000d7', 'Run')) as x(id, title);
insert into public.period_results (habit_id, period_start, outcome, finalized_at)
select x.id::uuid, '2026-10-01', 'missed', '2026-10-02 01:00+02'
  from (values ('00000000-0000-0000-0000-0000000000d6'), ('00000000-0000-0000-0000-0000000000d7')) as x(id);
insert into public.check_ins (habit_id, user_id, local_date, period_start, status, created_at, logged_by)
select x.h::uuid, u, '2026-10-01', '2026-10-01', 'approved', x.at::timestamptz, u
  from (values ('00000000-0000-0000-0000-0000000000d6', '2026-10-02 12:00+02'), ('00000000-0000-0000-0000-0000000000d7', '2026-10-01 20:00+02')) as x(h, at)
 cross join unnest(array['00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1']::uuid[]) u;
set local session_replication_role = origin;
update public.period_results set outcome = 'done' where habit_id in ('00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000d7');
select is((select count(*)::int from public.notifications where kind = 'group_milestone' and habit_id = '00000000-0000-0000-0000-0000000000d6'
            and payload ->> 'late' = 'true'), 2, 'a late upgrade still writes the group milestone, marked late');
select is((select push from public.notifications where kind = 'group_milestone' and habit_id = '00000000-0000-0000-0000-0000000000d6'
            and user_id = '00000000-0000-0000-0000-0000000000a1'), false, 'and it doesn''t push, even on Sound');
select is((select push from public.notifications where kind = 'group_milestone' and habit_id = '00000000-0000-0000-0000-0000000000d7'
            and user_id = '00000000-0000-0000-0000-0000000000a1'), true, 'an on-time check-in approved into a settled period does');
select is(array[private.push_allowed('00000000-0000-0000-0000-0000000000a1', 'kid_streak', null, (select v from t where k = 'fam'), '{"late": true}', now()),
                private.push_allowed('00000000-0000-0000-0000-0000000000a1', 'kid_streak', null, (select v from t where k = 'fam'), '{}', now())],
  array[false, true],
  'a late kid streak note stays in the Inbox too');

-- A late upgrade that merges two streaks doesn't pay again an N the later piece already earned
-- (nor call it "back"): 1–3 Sep, 5–11 Sep (5 and 7 under the 5 Sep start), then 4 Sep upgraded.
set local session_replication_role = replica;
insert into public.habits (id, owner_id, title, category, emoji, target_count, period, starts_on, week_start, created_at, created_by)
values ('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000f1', 'Floss', 'health', '🦷', 1, 'day', '2026-09-01', 1,
        '2026-09-01 08:00Z', '00000000-0000-0000-0000-0000000000f1');
set local session_replication_role = origin;
insert into public.period_results (habit_id, period_start, outcome, finalized_at)
select '00000000-0000-0000-0000-0000000000d8', d::date, case when d::date = '2026-09-04' then 'missed' else 'done' end, d + interval '1 day'
  from generate_series('2026-09-01'::timestamp, '2026-09-11', '1 day') d order by d;
update public.period_results set outcome = 'done' where habit_id = '00000000-0000-0000-0000-0000000000d8' and period_start = '2026-09-04';
select is((select array_agg(split_part(source_id, ':', 2) || ':' || split_part(source_id, ':', 3) order by split_part(source_id, ':', 2), split_part(source_id, ':', 3)::int) from ms
            where habit_id = '00000000-0000-0000-0000-0000000000d8'),
  array['2026-09-01:1', '2026-09-01:2', '2026-09-01:10', '2026-09-05:1', '2026-09-05:2', '2026-09-05:5', '2026-09-05:7'],
  'merging two streaks pays only the Ns neither piece reached (10), not 5 and 7 again');

select is((select array_agg(split_part(dedupe_key, ':', 3) || ':' || split_part(dedupe_key, ':', 4) || ':' || (payload ->> 'back')
                    order by split_part(dedupe_key, ':', 3), split_part(dedupe_key, ':', 4)::int)
             from public.notifications where kind = 'streak_milestone' and habit_id = '00000000-0000-0000-0000-0000000000d8'),
  array['2026-09-01:1:false', '2026-09-01:2:false', '2026-09-01:10:false', '2026-09-05:1:true', '2026-09-05:2:true', '2026-09-05:5:false', '2026-09-05:7:false'],
  '"back" only for the Ns an earlier streak reached');

-- "Back" doesn't depend on the order one statement's triggers fire in: periods inserted latest first.
set local session_replication_role = replica;
insert into public.habits (id, owner_id, title, category, emoji, target_count, period, starts_on, week_start, created_at, created_by)
values ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000f1', 'Journal', 'mind', '📓', 1, 'day', '2026-09-01', 1,
        '2026-09-01 08:00Z', '00000000-0000-0000-0000-0000000000f1');
set local session_replication_role = origin;
insert into public.period_results (habit_id, period_start, outcome, finalized_at)
select '00000000-0000-0000-0000-0000000000d9', d::date, case when d::date = '2026-09-02' then 'missed' else 'done' end, '2026-09-04 01:00Z'
  from generate_series('2026-09-01'::timestamp, '2026-09-03', '1 day') d order by d desc;
select is((select array_agg(split_part(dedupe_key, ':', 3) || ':' || (payload ->> 'back') order by split_part(dedupe_key, ':', 3))
             from public.notifications where kind = 'streak_milestone' and habit_id = '00000000-0000-0000-0000-0000000000d9'),
  array['2026-09-01:false', '2026-09-03:true'], 'settled latest first: the first streak is not "back", the later one is');

select * from finish();
rollback;
