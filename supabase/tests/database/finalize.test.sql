begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

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

-- Sunday weeks: on Thursday 8 Oct the week started Sunday 4 Oct and has 3 days left.
update public.profiles set week_start = 0 where id = '00000000-0000-0000-0000-0000000000a5';
select is((select row(period_start, days_left)::text
             from private.habit_summaries('00000000-0000-0000-0000-0000000000a5', '2026-10-08T10:00:00Z')
            where habit_id = '00000000-0000-0000-0000-00000000005b'),
  '(2026-10-04,3)', 'Sunday weeks shift the weekly period');

select * from finish();
rollback;
