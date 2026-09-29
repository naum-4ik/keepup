begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

select tests.create_user('00000000-0000-0000-0000-0000000000a3', 'frz-a@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000b3', 'frz-b@example.com');
update public.profiles set timezone = 'Europe/Rome' where id = '00000000-0000-0000-0000-0000000000a3';
set local session_replication_role = replica;
insert into public.habits (id, owner_id, title, category, target_count, period, starts_on, created_at)
values ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a3', 'Walk', 'fitness', 1, 'day', '2026-09-01', '2026-09-01T08:00:00Z');
set local session_replication_role = origin;

-- "Today" is Monday 5 Oct 2026 in Rome.
select throws_ok(
  $$select private.freeze_habit_impl('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a3',
      '2026-10-04', null, '2026-10-05T10:00:00Z')$$,
  'P0001', 'keepup:freeze_in_past', 'a pause cannot start in the past');
select lives_ok(
  $$select private.freeze_habit_impl('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a3',
      '2026-10-05', '2026-10-08', '2026-10-05T10:00:00Z')$$,
  'a pause can start today');
select throws_ok(
  $$select private.freeze_habit_impl('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a3',
      '2026-10-08', '2026-10-10', '2026-10-05T10:00:00Z')$$,
  'P0001', 'keepup:freeze_overlaps', 'pauses cannot overlap');
select throws_ok(
  $$select private.freeze_habit_impl('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a3',
      '2026-10-12', '2026-10-11', '2026-10-05T10:00:00Z')$$,
  'P0001', 'keepup:freeze_range_invalid', 'a pause cannot end before it starts');
select lives_ok(
  $$select private.freeze_habit_impl('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a3',
      '2026-10-20', null, '2026-10-05T10:00:00Z')$$,
  'an open-ended pause can be planned');

select ok(private.is_frozen('00000000-0000-0000-0000-00000000f001', '2026-10-07', '2026-10-08'), '7 Oct is paused');
select ok(not private.is_frozen('00000000-0000-0000-0000-00000000f001', '2026-10-04', '2026-10-05'), '4 Oct is not paused');

-- Resuming on 7 Oct: the running pause ends yesterday, the future one disappears.
select private.unfreeze_habit_impl('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a3', '2026-10-07T10:00:00Z');
select is((select ends_on from public.habit_freezes where starts_on = '2026-10-05'), '2026-10-06'::date,
  'resuming ends the running pause yesterday');
select is((select count(*)::int from public.habit_freezes where starts_on = '2026-10-20'), 0,
  'resuming removes pauses that had not started');

-- I1: on a weekly habit (Monday weeks) a pause blocks only paused days, never the rest of the week.
set local session_replication_role = replica;
insert into public.habits (id, owner_id, title, category, target_count, period, starts_on, created_at, week_start) values
  ('00000000-0000-0000-0000-00000000f011', '00000000-0000-0000-0000-0000000000a3', 'Resume', 'fitness', 3, 'week', '2026-09-28', '2026-09-28T08:00:00Z', 1),
  ('00000000-0000-0000-0000-00000000f012', '00000000-0000-0000-0000-0000000000a3', 'Saturday pause', 'fitness', 3, 'week', '2026-09-28', '2026-09-28T08:00:00Z', 1),
  ('00000000-0000-0000-0000-00000000f013', '00000000-0000-0000-0000-0000000000a3', 'Done then pause', 'fitness', 3, 'week', '2026-09-28', '2026-09-28T08:00:00Z', 1),
  ('00000000-0000-0000-0000-00000000f014', '00000000-0000-0000-0000-0000000000a3', 'Api pause', 'fitness', 1, 'day', '2026-09-01', '2026-09-01T08:00:00Z', 1);
set local session_replication_role = origin;

-- Resume mid-week: paused Monday 5 Oct, resumed Wednesday 7 Oct, checked in the same day.
select private.freeze_habit_impl('00000000-0000-0000-0000-00000000f011', '00000000-0000-0000-0000-0000000000a3',
  '2026-10-05', null, '2026-10-05T08:00:00Z');
select is((select frozen from private.habit_summaries('00000000-0000-0000-0000-0000000000a3', '2026-10-06T08:00:00Z')
            where habit_id = '00000000-0000-0000-0000-00000000f011'),
  true, 'a weekly habit is paused on a paused day');
select private.unfreeze_habit_impl('00000000-0000-0000-0000-00000000f011', '00000000-0000-0000-0000-0000000000a3', '2026-10-07T08:00:00Z');
select is((select row(frozen, frozen_until)::text from private.habit_summaries('00000000-0000-0000-0000-0000000000a3', '2026-10-07T08:00:00Z')
            where habit_id = '00000000-0000-0000-0000-00000000f011'),
  '(f,)', 'after resuming mid-week the summary is not paused and shows no past "until" date');
select lives_ok(
  $$select private.check_in_impl('00000000-0000-0000-0000-00000000f011', '00000000-0000-0000-0000-0000000000a3', '2026-10-07T08:00:00Z')$$,
  'after resuming mid-week, a check-in the same day works');

-- A pause scheduled for Saturday 10 Oct doesn't block Wednesday 7 Oct.
select private.freeze_habit_impl('00000000-0000-0000-0000-00000000f012', '00000000-0000-0000-0000-0000000000a3',
  '2026-10-10', '2026-10-11', '2026-10-07T08:00:00Z');
select is((select frozen from private.habit_summaries('00000000-0000-0000-0000-0000000000a3', '2026-10-07T08:00:00Z')
            where habit_id = '00000000-0000-0000-0000-00000000f012'),
  false, 'a pause scheduled for Saturday does not show Wednesday as paused');
select lives_ok(
  $$select private.check_in_impl('00000000-0000-0000-0000-00000000f012', '00000000-0000-0000-0000-0000000000a3', '2026-10-07T08:00:00Z')$$,
  'a pause scheduled for Saturday does not block a Wednesday check-in');
select is((select row(frozen, frozen_until)::text from private.habit_summaries('00000000-0000-0000-0000-0000000000a3', '2026-10-10T08:00:00Z')
            where habit_id = '00000000-0000-0000-0000-00000000f012'),
  '(t,2026-10-11)', 'on Saturday it is paused until Sunday');
select throws_ok(
  $$select private.check_in_impl('00000000-0000-0000-0000-00000000f012', '00000000-0000-0000-0000-0000000000a3', '2026-10-10T08:00:00Z')$$,
  'P0001', 'keepup:habit_frozen', 'a paused Saturday cannot be checked in');
select is(private.period_outcome(h, '2026-10-05'), 'skipped', 'an unfinished week with a paused day is skipped, not missed')
  from public.habits h where h.id = '00000000-0000-0000-0000-00000000f012';

-- 3/3 on Mon–Wed, then pause from Thursday: the week stays done and the streak isn't reduced.
select private.check_in_impl('00000000-0000-0000-0000-00000000f013', '00000000-0000-0000-0000-0000000000a3', t)
  from unnest(array['2026-09-28T08:00:00Z', '2026-09-29T08:00:00Z', '2026-09-30T08:00:00Z',
                    '2026-10-05T08:00:00Z', '2026-10-06T08:00:00Z', '2026-10-07T08:00:00Z']::timestamptz[]) as t;
select is((select row(current_streak, best_streak)::text from private.habit_streaks('00000000-0000-0000-0000-00000000f013', '2026-10-07T10:00:00Z')),
  '(2,2)', 'two finished weeks: streak 2');
select private.freeze_habit_impl('00000000-0000-0000-0000-00000000f013', '00000000-0000-0000-0000-0000000000a3',
  '2026-10-08', null, '2026-10-08T08:00:00Z');
select is(private.period_outcome(h, '2026-10-05'), 'done', 'a week finished 3/3 and then paused is done, not skipped')
  from public.habits h where h.id = '00000000-0000-0000-0000-00000000f013';
select is((select row(current_streak, best_streak)::text from private.habit_streaks('00000000-0000-0000-0000-00000000f013', '2026-10-08T10:00:00Z')),
  '(2,2)', 'pausing after finishing the week does not reduce the streak');
select is((select row(current_streak, best_streak)::text from private.habit_streaks('00000000-0000-0000-0000-00000000f013', '2026-10-12T10:00:00Z')),
  '(2,2)', 'nor once the week has closed');

select throws_ok(
  $$select private.freeze_habit_impl('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000b3',
      '2026-11-01', null, '2026-10-05T10:00:00Z')$$,
  'P0002', 'keepup:habit_not_found', 'a user cannot pause someone else''s habit');

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a3');
select lives_ok($$select public.freeze_habit('00000000-0000-0000-0000-00000000f001', '2099-01-01')$$,
  'the owner can pause through the API');
select lives_ok($$select public.freeze_habit('00000000-0000-0000-0000-00000000f014')$$,
  'a pause can omit its start date through the API');
select is((select starts_on from public.habit_freezes where habit_id = '00000000-0000-0000-0000-00000000f014'),
  (now() at time zone 'Europe/Rome')::date, 'and then starts today in the owner''s time zone');
select throws_ok(
  $$select private.freeze_habit_impl('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a3',
      '2099-02-01', null, now())$$,
  '42501', null, 'API users cannot call the rule implementation directly');
select ok((select count(*) from public.habit_freezes) > 0, 'the owner can read their pauses');

select tests.authenticate_as('00000000-0000-0000-0000-0000000000b3');
select is((select count(*)::int from public.habit_freezes), 0, 'others cannot read them');

select * from finish();
rollback;
