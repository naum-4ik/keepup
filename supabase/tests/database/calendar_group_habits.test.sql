begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- Progress → Calendar counts the group habits you take part in (20261009130000), judged for you the
-- way week_overview does (the same fixture as week_overview_groups.test.sql).
select tests.create_user('00000000-0000-0000-0000-0000000000a8', 'calg-anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b8', 'calg-dan@example.com', '{"full_name":"Dan"}');
select tests.create_user('00000000-0000-0000-0000-0000000000e8', 'calg-eve@example.com', '{"full_name":"Eve"}');
update public.profiles set timezone = 'Europe/Rome', week_start = 1
 where id in ('00000000-0000-0000-0000-0000000000a8', '00000000-0000-0000-0000-0000000000b8', '00000000-0000-0000-0000-0000000000e8');

-- "Now" is Thursday 8 Oct 2026, 12:00 in Rome. This week: Mon 5 – Sun 11 Oct. Last week: 28 Sep – 4 Oct.
-- Family (Rome, Monday weeks) since 1 Sep with Anna and Dan; Eve joins on Wednesday 7 Oct at 09:00.
set local session_replication_role = replica;
insert into public.groups (id, name, kind, timezone, week_start, created_by, created_at)
values ('00000000-0000-0000-0000-0000000000f8', 'Family', 'family', 'Europe/Rome', 1, '00000000-0000-0000-0000-0000000000a8', '2026-09-01T08:00:00Z');
insert into public.group_members (group_id, user_id, role, joined_at) values
  ('00000000-0000-0000-0000-0000000000f8', '00000000-0000-0000-0000-0000000000a8', 'admin', '2026-09-01T08:00:00Z'),
  ('00000000-0000-0000-0000-0000000000f8', '00000000-0000-0000-0000-0000000000b8', 'member', '2026-09-01T09:00:00Z'),
  ('00000000-0000-0000-0000-0000000000f8', '00000000-0000-0000-0000-0000000000e8', 'member', '2026-10-07T07:00:00Z');
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, created_at, created_by) values
  ('00000000-0000-0000-0000-0000000008d1', null, '00000000-0000-0000-0000-0000000000f8', 'Dinner', 'people', '🍽️', 1, 'day', '2026-09-01', 1, '2026-09-01T08:00:00Z', '00000000-0000-0000-0000-0000000000a8'),
  ('00000000-0000-0000-0000-0000000008d2', null, '00000000-0000-0000-0000-0000000000f8', 'Game night', 'people', '🎲', 1, 'week', '2026-09-01', 1, '2026-09-01T08:00:00Z', '00000000-0000-0000-0000-0000000000a8'),
  ('00000000-0000-0000-0000-0000000008d3', '00000000-0000-0000-0000-0000000000a8', null, 'Walk', 'fitness', '🚶', 1, 'day', '2026-09-28', 1, '2026-09-28T08:00:00Z', '00000000-0000-0000-0000-0000000000a8'),
  -- Stretch (group, daily) started on Monday and ended on Tuesday.
  ('00000000-0000-0000-0000-0000000008d4', null, '00000000-0000-0000-0000-0000000000f8', 'Stretch', 'health', '🧘', 1, 'day', '2026-10-05', 1, '2026-10-04T08:00:00Z', '00000000-0000-0000-0000-0000000000a8'),
  -- Floss (Anna's own, daily) started on Monday and ended on Tuesday too.
  ('00000000-0000-0000-0000-0000000008d5', '00000000-0000-0000-0000-0000000000a8', null, 'Floss', 'health', '🪥', 1, 'day', '2026-10-05', 1, '2026-10-04T08:00:00Z', '00000000-0000-0000-0000-0000000000a8');
update public.habits set ends_on = '2026-10-06' where id in ('00000000-0000-0000-0000-0000000008d4', '00000000-0000-0000-0000-0000000008d5');
set local session_replication_role = origin;

-- Dan is paused on Dinner on Wednesday.
insert into public.habit_freezes (habit_id, user_id, starts_on, ends_on)
values ('00000000-0000-0000-0000-0000000008d1', '00000000-0000-0000-0000-0000000000b8', '2026-10-07', '2026-10-07');

select private.check_in_impl(h, u, t)
  from (values
    -- Dinner: Anna Mon, Tue and today; Dan Mon only. Eve taps on Wednesday, the day she joined.
    ('00000000-0000-0000-0000-0000000008d1'::uuid, '00000000-0000-0000-0000-0000000000a8'::uuid, '2026-10-05T08:00:00Z'::timestamptz),
    ('00000000-0000-0000-0000-0000000008d1', '00000000-0000-0000-0000-0000000000a8', '2026-10-06T08:00:00Z'),
    ('00000000-0000-0000-0000-0000000008d1', '00000000-0000-0000-0000-0000000000a8', '2026-10-08T08:00:00Z'),
    ('00000000-0000-0000-0000-0000000008d1', '00000000-0000-0000-0000-0000000000b8', '2026-10-05T09:00:00Z'),
    ('00000000-0000-0000-0000-0000000008d1', '00000000-0000-0000-0000-0000000000e8', '2026-10-07T08:00:00Z'),
    -- Game night (weekly): Anna on Tuesday, Eve on Wednesday; Dan not yet.
    ('00000000-0000-0000-0000-0000000008d2', '00000000-0000-0000-0000-0000000000a8', '2026-10-06T18:00:00Z'),
    ('00000000-0000-0000-0000-0000000008d2', '00000000-0000-0000-0000-0000000000e8', '2026-10-07T18:00:00Z'),
    -- Walk (Anna's own): Monday only.
    ('00000000-0000-0000-0000-0000000008d3', '00000000-0000-0000-0000-0000000000a8', '2026-10-05T07:00:00Z'),
    -- Stretch: both of them, Monday and Tuesday (a 2-day group streak, then the end).
    ('00000000-0000-0000-0000-0000000008d4', '00000000-0000-0000-0000-0000000000a8', '2026-10-05T07:30:00Z'),
    ('00000000-0000-0000-0000-0000000008d4', '00000000-0000-0000-0000-0000000000b8', '2026-10-05T07:30:00Z'),
    ('00000000-0000-0000-0000-0000000008d4', '00000000-0000-0000-0000-0000000000a8', '2026-10-06T07:30:00Z'),
    ('00000000-0000-0000-0000-0000000008d4', '00000000-0000-0000-0000-0000000000b8', '2026-10-06T07:30:00Z'),
    -- Floss: Monday and Tuesday (a 2-day streak, then the end).
    ('00000000-0000-0000-0000-0000000008d5', '00000000-0000-0000-0000-0000000000a8', '2026-10-05T07:40:00Z'),
    ('00000000-0000-0000-0000-0000000008d5', '00000000-0000-0000-0000-0000000000a8', '2026-10-06T07:40:00Z'),
    -- Game night last week: Anna and Dan both (a 1-week group streak still running).
    ('00000000-0000-0000-0000-0000000008d2', '00000000-0000-0000-0000-0000000000a8', '2026-10-01T18:00:00Z'),
    ('00000000-0000-0000-0000-0000000008d2', '00000000-0000-0000-0000-0000000000b8', '2026-10-01T18:00:00Z')) as v(h, u, t);

create temp view anna as
  select local_date::text as d, habit_id, outcome, check_ins
    from private.calendar_cells_impl('00000000-0000-0000-0000-0000000000a8', '2026-09-28', '2026-10-11', '2026-10-08T10:00:00Z');
create temp view dan as
  select local_date::text as d, habit_id, outcome, check_ins
    from private.calendar_cells_impl('00000000-0000-0000-0000-0000000000b8', '2026-09-28', '2026-10-11', '2026-10-08T10:00:00Z');
create temp view eve as
  select local_date::text as d, habit_id, outcome, check_ins
    from private.calendar_cells_impl('00000000-0000-0000-0000-0000000000e8', '2026-09-28', '2026-10-11', '2026-10-08T10:00:00Z');

select results_eq(
  $$select d, outcome, check_ins from anna where habit_id = '00000000-0000-0000-0000-0000000008d1' and d >= '2026-10-05' order by d$$,
  $$values ('2026-10-05', 'done', 1), ('2026-10-06', 'done', 1), ('2026-10-07', 'missed', 0), ('2026-10-08', 'done', 1)$$,
  'a daily group habit shows each day, done when you did your part (the Today ring''s rule), whatever the others did');
select is((select count(*)::int from anna where habit_id = '00000000-0000-0000-0000-0000000008d1' and d < '2026-10-05' and outcome = 'missed'), 7,
  'earlier days of a group habit count too');
select results_eq(
  $$select d, outcome, check_ins from dan where habit_id = '00000000-0000-0000-0000-0000000008d1' and d >= '2026-10-05' order by d$$,
  $$values ('2026-10-05', 'done', 1), ('2026-10-06', 'missed', 0), ('2026-10-08', 'open', 0)$$,
  'a day you were paused on isn''t counted; today is open until you check in');
select results_eq(
  $$select d, outcome, check_ins from eve where habit_id = '00000000-0000-0000-0000-0000000008d1' order by d$$,
  $$values ('2026-10-08', 'open', 0)$$,
  'a member who joined mid-day isn''t counted for that day, even after a check-in; from the next day on they are');
select is((select count(*)::int from eve where habit_id = '00000000-0000-0000-0000-0000000008d2'), 0,
  'a weekly group habit: a check-in in a period you weren''t required in doesn''t show');
select results_eq(
  $$select d, outcome, check_ins from anna where habit_id = '00000000-0000-0000-0000-0000000008d2' order by d$$,
  $$values ('2026-10-01', null::text, 1), ('2026-10-06', null::text, 1)$$,
  'a weekly group habit shows on the days you checked in');
select results_eq(
  $$select d, outcome, check_ins from anna where habit_id = '00000000-0000-0000-0000-0000000008d4' order by d$$,
  $$values ('2026-10-05', 'done', 1), ('2026-10-06', 'done', 1)$$,
  'an ended group habit shows its days up to the end, nothing after');
select results_eq(
  $$select d, outcome, check_ins from anna where habit_id = '00000000-0000-0000-0000-0000000008d3' order by d$$,
  $$values ('2026-09-28', 'skipped', 0), ('2026-09-29', 'missed', 0), ('2026-09-30', 'missed', 0), ('2026-10-01', 'missed', 0),
           ('2026-10-02', 'missed', 0), ('2026-10-03', 'missed', 0), ('2026-10-04', 'missed', 0), ('2026-10-05', 'done', 1),
           ('2026-10-06', 'missed', 0), ('2026-10-07', 'missed', 0), ('2026-10-08', 'open', 0)$$,
  'your own habits are unchanged');

-- The whole group pauses Dinner today: Dan's open day reads skipped (not "to do"), Anna's done day stays done.
set local session_replication_role = replica;
insert into public.habit_freezes (habit_id, user_id, starts_on, ends_on)
values ('00000000-0000-0000-0000-0000000008d1', null, '2026-10-08', '2026-10-08');
set local session_replication_role = origin;
select is((select outcome from dan where habit_id = '00000000-0000-0000-0000-0000000008d1' and d = '2026-10-08'), 'skipped',
  'a whole-group pause today reads skipped, as on your own habits');

select is((select array_agg(private.calendar_start_impl(u, '2026-10-08T10:00:00Z')::text order by n)
             from (values (1, '00000000-0000-0000-0000-0000000000a8'::uuid), (2, '00000000-0000-0000-0000-0000000000e8'::uuid)) as v(n, u)),
  array['2026-09-01', '2026-10-07'],
  'the calendar starts at the earliest group habit you take part in, from the day you joined');
select ok(not has_function_privilege('anon', 'public.calendar_start()', 'execute'), 'signed-out visitors cannot call calendar_start');
select ok(has_function_privilege('authenticated', 'public.calendar_start()', 'execute'), 'signed-in users can');

select * from finish();
rollback;
