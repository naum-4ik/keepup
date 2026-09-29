begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

select tests.create_user('00000000-0000-0000-0000-0000000000a5', 'fin-a@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000b5', 'fin-b@example.com');
update public.profiles set timezone = 'Europe/Rome' where id = '00000000-0000-0000-0000-0000000000a5';

set local session_replication_role = replica;
insert into public.habits (id, owner_id, title, category, target_count, period, starts_on, created_at, archived_at) values
  ('00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-0000000000a5', 'Streak', 'mind', 1, 'day', '2026-10-01', '2026-10-01T08:00:00Z', null),
  ('00000000-0000-0000-0000-00000000005f', '00000000-0000-0000-0000-0000000000a5', 'Frozen', 'mind', 1, 'day', '2026-10-01', '2026-10-01T08:00:00Z', null),
  ('00000000-0000-0000-0000-00000000005b', '00000000-0000-0000-0000-0000000000a5', 'Late week', 'fitness', 3, 'week', '2026-10-03', '2026-10-03T08:00:00Z', null),
  ('00000000-0000-0000-0000-00000000005c', '00000000-0000-0000-0000-0000000000a5', 'Archived', 'home', 1, 'day', '2026-10-01', '2026-10-01T08:00:00Z', '2026-10-02T10:00:00Z'),
  ('00000000-0000-0000-0000-00000000005d', '00000000-0000-0000-0000-0000000000a5', 'Next week', 'home', 1, 'day', '2026-10-12', '2026-10-05T08:00:00Z', null);
set local session_replication_role = origin;
insert into public.habit_freezes (habit_id, starts_on, ends_on)
values ('00000000-0000-0000-0000-00000000005f', '2026-10-03', '2026-10-03');

select private.check_in_impl(h, '00000000-0000-0000-0000-0000000000a5', t)
  from (values
    ('00000000-0000-0000-0000-00000000005a'::uuid, '2026-10-01T09:00:00Z'::timestamptz),
    ('00000000-0000-0000-0000-00000000005a', '2026-10-02T09:00:00Z'),
    ('00000000-0000-0000-0000-00000000005a', '2026-10-04T09:00:00Z'),
    ('00000000-0000-0000-0000-00000000005f', '2026-10-01T09:00:00Z'),
    ('00000000-0000-0000-0000-00000000005f', '2026-10-02T09:00:00Z'),
    ('00000000-0000-0000-0000-00000000005f', '2026-10-04T09:00:00Z')) as v(h, t);

-- Monday 5 Oct 14:00 in Rome
select is(private.finalize_periods('2026-10-05T12:00:00Z'), 9, 'closed periods are finalized (4 + 4 + 1; not-started habits none)');
select is(private.finalize_periods('2026-10-05T12:00:00Z'), 0, 'finalizing again changes nothing');

select is((select array_agg(outcome order by period_start) from public.period_results where habit_id = '00000000-0000-0000-0000-00000000005a'),
  array['done', 'done', 'missed', 'done'], 'done, done, missed, done');
select is((select array_agg(outcome order by period_start) from public.period_results where habit_id = '00000000-0000-0000-0000-00000000005f'),
  array['done', 'done', 'skipped', 'done'], 'a paused day is skipped');
select is((select outcome from public.period_results where habit_id = '00000000-0000-0000-0000-00000000005b'),
  'skipped', 'a habit starting on Saturday doesn''t fail its first, partial week');
select is((select count(*)::int from public.period_results where habit_id = '00000000-0000-0000-0000-00000000005c'),
  0, 'archived habits are not finalized');

select is((select row(current_streak, best_streak)::text from private.habit_streaks('00000000-0000-0000-0000-00000000005a', '2026-10-05T12:00:00Z')),
  '(1,2)', 'current streak 1, best 2');
select is((select row(current_streak, best_streak)::text from private.habit_streaks('00000000-0000-0000-0000-00000000005f', '2026-10-05T12:00:00Z')),
  '(3,3)', 'a paused day doesn''t break the streak');

delete from public.period_results where habit_id = '00000000-0000-0000-0000-00000000005a';
select is((select row(current_streak, best_streak)::text from private.habit_streaks('00000000-0000-0000-0000-00000000005a', '2026-10-05T12:00:00Z')),
  '(1,2)', 'streaks are right before the finalization job runs');

select private.check_in_impl('00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-0000000000a5', '2026-10-05T13:00:00Z');
select is((select row(current_streak, best_streak)::text from private.habit_streaks('00000000-0000-0000-0000-00000000005a', '2026-10-05T14:00:00Z')),
  '(2,2)', 'today''s check-in counts immediately');

select is((select row(done_count, checked_in_today, days_left)::text
             from private.habit_summaries('00000000-0000-0000-0000-0000000000a5', '2026-10-05T14:00:00Z')
            where habit_id = '00000000-0000-0000-0000-00000000005a'),
  '(1,t,1)', 'summary for a daily habit done today');
select is((select row(done_count, days_left, current_streak)::text
             from private.habit_summaries('00000000-0000-0000-0000-0000000000a5', '2026-10-08T10:00:00Z')
            where habit_id = '00000000-0000-0000-0000-00000000005b'),
  '(0,4,0)', 'on Thursday a Monday-week habit has 4 days left (Thu–Sun)');
select is((select not_started from private.habit_summaries('00000000-0000-0000-0000-0000000000a5', '2026-10-05T14:00:00Z')
            where habit_id = '00000000-0000-0000-0000-00000000005d'),
  true, 'a habit starting next week shows as not started');

select is((select array_agg(outcome order by period_start)
             from private.habit_history('00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-0000000000a5', '2026-10-05T14:00:00Z', 10)),
  array['done', 'done', 'missed', 'done', 'done'], 'history ends with today''s period');

select is((select count(*)::int from cron.job where jobname = 'keepup-finalize-periods'), 1,
  'the finalization job is scheduled');

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a5');
select is((select count(*)::int from public.habit_summaries()), 5, 'the owner gets summaries for all their habits');
select throws_ok($$select private.finalize_periods(now())$$, '42501', null, 'API users cannot run finalization');

select tests.authenticate_as('00000000-0000-0000-0000-0000000000b5');
select is((select count(*)::int from public.habit_summaries()), 0, 'others get nothing');

reset role;
set local role anon;
select throws_ok($$select * from public.habit_summaries()$$, '42501', null, 'anonymous visitors cannot read summaries');
reset role;

-- C1: week start is snapshotted per habit at creation, not read live from the profile.
set local session_replication_role = replica;
insert into public.habits (id, owner_id, title, category, target_count, period, starts_on, created_at, archived_at, week_start) values
  ('00000000-0000-0000-0000-00000000005e', '00000000-0000-0000-0000-0000000000a5', 'Sunday week', 'fitness', 3, 'week', '2026-10-03', '2026-10-03T08:00:00Z', null, 0);
set local session_replication_role = origin;

select is((select row(period_start, days_left)::text
             from private.habit_summaries('00000000-0000-0000-0000-0000000000a5', '2026-10-08T10:00:00Z')
            where habit_id = '00000000-0000-0000-0000-00000000005e'),
  '(2026-10-04,3)', 'a habit created with week_start=0 shifts its weekly period, Thursday has 3 days left');

select is((select count(*)::int from public.period_results where habit_id = '00000000-0000-0000-0000-00000000005b'), 1,
  'the late-week Monday habit has exactly one finalized (skipped) period so far');

update public.profiles set week_start = 0 where id = '00000000-0000-0000-0000-0000000000a5';

select is((select row(current_streak, best_streak)::text from private.habit_streaks('00000000-0000-0000-0000-00000000005b', '2026-10-08T10:00:00Z')),
  '(0,0)', 'switching the profile to Sunday weeks does not change the existing Monday habit''s streak');

select private.finalize_periods('2026-10-08T10:00:00Z');

select is((select count(*)::int from public.period_results where habit_id = '00000000-0000-0000-0000-00000000005b'), 1,
  'and finalizing again under Sunday weeks adds no new or overlapping rows for it');
select is((select array_agg(outcome order by period_start) from public.period_results where habit_id = '00000000-0000-0000-0000-00000000005b'),
  array['skipped'], 'its finalized period is unchanged');

update public.profiles set week_start = 1 where id = '00000000-0000-0000-0000-0000000000a5';

-- I1: a westward time-zone change cannot reopen an already-finalized day (5a's Oct 5-7 are now
-- finalized, thanks to the finalize_periods('2026-10-08...') call above).
update public.profiles set timezone = 'America/New_York' where id = '00000000-0000-0000-0000-0000000000a5';
select throws_ok(
  $$select private.check_in_impl('00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-0000000000a5', '2026-10-07T02:00:00Z')$$,
  'P0001', 'keepup:period_closed', 'a westward time-zone change cannot reopen an already-finalized day');
update public.profiles set timezone = 'Europe/Rome' where id = '00000000-0000-0000-0000-0000000000a5';

-- I2: an archived habit's streak/history freeze at the archive date.
set local session_replication_role = replica;
insert into public.habits (id, owner_id, title, category, target_count, period, starts_on, created_at, archived_at, week_start) values
  ('00000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-0000000000a5', 'Archived cap', 'mind', 1, 'day', '2026-10-01', '2026-10-01T08:00:00Z', null, 1);
set local session_replication_role = origin;

select private.check_in_impl(h, '00000000-0000-0000-0000-0000000000a5', t)
  from (values
    ('00000000-0000-0000-0000-000000000061'::uuid, '2026-10-01T09:00:00Z'::timestamptz),
    ('00000000-0000-0000-0000-000000000061', '2026-10-02T09:00:00Z'),
    ('00000000-0000-0000-0000-000000000061', '2026-10-03T09:00:00Z')) as v(h, t);

set local session_replication_role = replica;
update public.habits set archived_at = '2026-10-04T10:00:00Z' where id = '00000000-0000-0000-0000-000000000061';
set local session_replication_role = origin;

select is((select row(current_streak, best_streak)::text from private.habit_streaks('00000000-0000-0000-0000-000000000061', '2026-10-26T10:00:00Z')),
  '(3,3)', 'an archived habit''s streak freezes at the archive date, weeks later');
select is((select max(period_start) from private.habit_history('00000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-0000000000a5', '2026-10-26T10:00:00Z', 10)),
  '2026-10-04'::date, 'history for an archived habit ends at the archive-day period');
select is((select count(*)::int from private.habit_history('00000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-0000000000a5', '2026-10-26T10:00:00Z', 10)),
  4, 'and does not extend past it, weeks later');

-- M1: an open-ended pause reports frozen_until as null, not a bogus max(ends_on).
set local session_replication_role = replica;
insert into public.habits (id, owner_id, title, category, target_count, period, starts_on, created_at, archived_at, week_start) values
  ('00000000-0000-0000-0000-000000000062', '00000000-0000-0000-0000-0000000000a5', 'Open pause', 'mind', 1, 'day', '2026-10-01', '2026-10-01T08:00:00Z', null, 1);
set local session_replication_role = origin;
insert into public.habit_freezes (habit_id, starts_on, ends_on) values ('00000000-0000-0000-0000-000000000062', '2026-10-05', null);

select is((select frozen_until from private.habit_summaries('00000000-0000-0000-0000-0000000000a5', '2026-10-08T10:00:00Z')
            where habit_id = '00000000-0000-0000-0000-000000000062'),
  null, 'an open-ended pause reports frozen_until as null');

-- A monthly habit starting mid-month (31 Jan): its partial first period is never missed.
set local session_replication_role = replica;
insert into public.habits (id, owner_id, title, category, target_count, period, starts_on, created_at, archived_at, week_start) values
  ('00000000-0000-0000-0000-000000000063', '00000000-0000-0000-0000-0000000000a5', 'Monthly', 'learning', 1, 'month', '2026-01-31', '2026-01-31T08:00:00Z', null, 1);
set local session_replication_role = origin;
select private.check_in_impl('00000000-0000-0000-0000-000000000063', '00000000-0000-0000-0000-0000000000a5', '2026-01-31T09:00:00Z');

select is((select array_agg(outcome order by period_start)
             from private.habit_history('00000000-0000-0000-0000-000000000063', '00000000-0000-0000-0000-0000000000a5', '2026-04-05T10:00:00Z', 10)),
  array['done', 'missed', 'missed', 'open'],
  'a monthly habit starting 31 Jan: January (its partial first period) is done, Feb and Mar missed, April open');

-- habit_history for another user returns nothing.
select is((select count(*)::int from private.habit_history('00000000-0000-0000-0000-00000000005a', '00000000-0000-0000-0000-0000000000b5', '2026-10-05T14:00:00Z', 10)),
  0, 'habit_history for another user returns no rows');

select * from finish();
rollback;
