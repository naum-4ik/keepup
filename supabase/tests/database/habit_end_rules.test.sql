-- Final-review fixes to habit ends (20260930180000): the finish summary's guard on group habits (D1),
-- the short last period (D2) and no end changes after the end (D3).
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');
select tests.create_user('00000000-0000-0000-0000-0000000000e1', 'eve@example.com', '{"full_name":"Eve"}');
update public.profiles set timezone = 'UTC', week_start = 1;

-- Family (UTC, Monday weeks), Anna and Dan members since 1 Sep. Eve is an outsider.
-- Two weekly ×3 habits from Wed 7 Oct to Tue 3 Nov: the last week (Mon 2 – Tue 3 Nov) has room for 2.
set local session_replication_role = replica;
insert into public.groups (id, name, kind, timezone, week_start, created_by, created_at)
values ('00000000-0000-0000-0000-0000000000f1', 'Family', 'family', 'UTC', 1, '00000000-0000-0000-0000-0000000000a1', '2026-09-01T08:00:00Z');
insert into public.group_members (group_id, user_id, role, joined_at) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'admin', '2026-09-01T08:00:00Z'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b1', 'member', '2026-09-01T09:00:00Z');
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, ends_on, week_start, created_at, created_by) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', null, 'Run', 'fitness', '🏃', 3, 'week', '2026-10-07', '2026-11-03', 1, '2026-10-01T08:00:00Z', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000d2', null, '00000000-0000-0000-0000-0000000000f1', 'Walk', 'fitness', '🚶', 3, 'week', '2026-10-07', '2026-11-03', 1, '2026-10-01T08:00:00Z', '00000000-0000-0000-0000-0000000000a1');
set local session_replication_role = origin;

-- Perfect: Wed–Fri in the first week, Mon–Wed after, and Mon–Tue in the short last week.
do $$
declare
  v_pair record;
  v_at timestamptz;
begin
  for v_pair in select * from (values ('00000000-0000-0000-0000-0000000000d1'::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid),
                                      ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a1'),
                                      ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b1')) p(habit_id, user_id) loop
    foreach v_at in array array['2026-10-07T09:00:00Z', '2026-10-08T09:00:00Z', '2026-10-09T09:00:00Z',
                                '2026-10-12T09:00:00Z', '2026-10-13T09:00:00Z', '2026-10-14T09:00:00Z',
                                '2026-10-19T09:00:00Z', '2026-10-20T09:00:00Z', '2026-10-21T09:00:00Z',
                                '2026-10-26T09:00:00Z', '2026-10-27T09:00:00Z', '2026-10-28T09:00:00Z',
                                '2026-11-02T09:00:00Z', '2026-11-03T09:00:00Z']::timestamptz[] loop
      perform private.check_in_impl(v_pair.habit_id, v_pair.user_id, v_at);
    end loop;
  end loop;
end;
$$;
select private.finalize_periods('2026-11-10T12:00:00Z');

-- D2: the short last week is never missed.
select results_eq($$select period_start::text, outcome from public.period_results
                     where habit_id = '00000000-0000-0000-0000-0000000000d1' and period_start <= '2026-11-02' order by 1$$,
  $$values ('2026-10-05', 'done'), ('2026-10-12', 'done'), ('2026-10-19', 'done'), ('2026-10-26', 'done'), ('2026-11-02', 'skipped')$$,
  'a perfect run: the short last week is skipped, not missed');
select is((select current_streak from private.habit_streaks('00000000-0000-0000-0000-0000000000d1', '2026-11-10T12:00:00Z')), 4,
  'and the streak is not broken');
select results_eq($$select period_start::text, outcome from public.period_results
                     where habit_id = '00000000-0000-0000-0000-0000000000d2' and period_start <= '2026-11-02' order by 1$$,
  $$values ('2026-10-05', 'done'), ('2026-10-12', 'done'), ('2026-10-19', 'done'), ('2026-10-26', 'done'), ('2026-11-02', 'skipped')$$,
  'the group version: the short last week is skipped too');
select is((select count(*)::int from public.notifications where kind = 'group_streak_ended' and habit_id = '00000000-0000-0000-0000-0000000000d2'), 0,
  'and no "group streak ended"');
select results_eq($$select done, total from private.habit_finish_summary_impl('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d1', '2026-11-10T12:00:00Z')$$,
  $$values (4, 4)$$, 'the finish card: 4 of 4 weeks (the short one does not count against you)');
-- A short last week that was completed anyway still counts as done.
select is((select private.period_outcome(jsonb_populate_record(h, '{"target_count": 2}'), '2026-11-02')
             from public.habits h where h.id = '00000000-0000-0000-0000-0000000000d1'),
  'done', 'a short last week that was finished is done');

-- D1: an outsider can't read a group habit's finish summary; members can.
select throws_ok($$select * from private.habit_finish_summary_impl('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d2', '2026-11-10T12:00:00Z')$$,
  'P0002', 'keepup:habit_not_found', 'an outsider cannot read a group habit''s finish summary');
select lives_ok($$select * from private.habit_finish_summary_impl('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d2', '2026-11-10T12:00:00Z')$$,
  'a member can');

-- D3: after the end only Keep going or Finish apply.
select throws_ok($$select private.set_habit_end_impl('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d1', '2026-12-31', '2026-11-10T12:00:00Z')$$,
  'P0001', 'keepup:end_passed', 'after the end, the end cannot be moved');
select throws_ok($$select private.set_habit_end_impl('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d1', null, '2026-11-10T12:00:00Z')$$,
  'P0001', 'keepup:end_passed', 'or removed (Keep going does that)');
select lives_ok($$select private.set_habit_end_impl('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d1', '2026-12-31', '2026-11-03T12:00:00Z')$$,
  'on the last day it can still be extended');
select lives_ok($$select private.keep_going_impl('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d2', '2026-11-10T12:00:00Z')$$,
  'Keep going still works after the end');

select * from finish();
rollback;
