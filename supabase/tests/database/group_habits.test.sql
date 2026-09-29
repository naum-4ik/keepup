begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');
select tests.create_user('00000000-0000-0000-0000-0000000000c1', 'carol@example.com', '{"full_name":"Carol"}');
select tests.create_user('00000000-0000-0000-0000-0000000000e1', 'eve@example.com', '{"full_name":"Eve"}');
update public.profiles set timezone = 'Europe/Rome' where id = '00000000-0000-0000-0000-0000000000a1';

-- Family (Rome, Monday weeks), created 1 Sep; Dan joined 1 Sep; Eve joins 7 Oct (mid-week).
set local session_replication_role = replica;
insert into public.groups (id, name, kind, timezone, week_start, created_by, created_at)
values ('00000000-0000-0000-0000-0000000000f1', 'Family', 'family', 'Europe/Rome', 1, '00000000-0000-0000-0000-0000000000a1', '2026-09-01T08:00:00Z');
insert into public.group_members (group_id, user_id, role, joined_at) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'admin', '2026-09-01T08:00:00Z'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b1', 'member', '2026-09-01T09:00:00Z');
insert into public.profiles (id, display_name, kind, group_id, created_at)
values ('00000000-0000-0000-0000-00000000c0de', 'Mary', 'child', '00000000-0000-0000-0000-0000000000f1', '2026-09-01T10:00:00Z');
set local session_replication_role = origin;

-- Creating
select throws_ok($$select private.create_group_habit_impl('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1',
  'Walk', '🚶', 'fitness', 1, 'day', null, false, '{}', '2026-10-05T08:00:00Z')$$,
  'P0001', 'keepup:not_admin', 'only admins create group habits');
select throws_ok($$select private.create_group_habit_impl('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1',
  'Walk', '🚶', 'fitness', 1, 'day', null, false, '{00000000-0000-0000-0000-0000000000b1}', '2026-10-05T08:00:00Z')$$,
  'P0002', 'keepup:child_not_found', 'only the group''s children can be included');

-- Two habits, backdated (created 1 Sep) so the October periods are ordinary ones.
set local session_replication_role = replica;
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, created_at, created_by) values
  ('00000000-0000-0000-0000-0000000000d1', null, '00000000-0000-0000-0000-0000000000f1', 'Family dinner', 'people', '🍽️', 1, 'day', '2026-09-01', 1, '2026-09-01T08:00:00Z', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000d2', null, '00000000-0000-0000-0000-0000000000f1', 'Read together', 'learning', '📖', 1, 'day', '2026-09-01', 1, '2026-09-01T08:00:00Z', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000d3', null, '00000000-0000-0000-0000-0000000000f1', 'Game night', 'people', '🎲', 1, 'week', '2026-09-01', 1, '2026-09-01T08:00:00Z', '00000000-0000-0000-0000-0000000000a1');
insert into public.group_habit_participants (habit_id, profile_id) values
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-00000000c0de');
set local session_replication_role = origin;

select is((private.create_group_habit_impl('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1',
  'Walk', '🚶', 'fitness', 1, 'day', null, false, '{00000000-0000-0000-0000-00000000c0de}', '2026-10-05T08:00:00Z')).starts_on,
  private.local_date(now(), 'Europe/Rome'), 'a group habit starts today in the group''s time zone');
-- (habit_rules uses the real now(), like M2, so the expectation is today's date in Rome.)
select is((select count(*)::int from public.group_habit_participants gp join public.habits h on h.id = gp.habit_id where h.title = 'Walk'),
  1, 'the included child is a participant');

-- Required members
select set_eq($$select private.required_members(h, '2026-10-05') from public.habits h where h.id = '00000000-0000-0000-0000-0000000000d1'$$,
  $$values ('00000000-0000-0000-0000-0000000000a1'::uuid), ('00000000-0000-0000-0000-0000000000b1'::uuid)$$,
  'every adult member is required; a child not included is not');
select set_eq($$select private.required_members(h, '2026-10-05') from public.habits h where h.id = '00000000-0000-0000-0000-0000000000d2'$$,
  $$values ('00000000-0000-0000-0000-0000000000a1'::uuid), ('00000000-0000-0000-0000-0000000000b1'::uuid), ('00000000-0000-0000-0000-00000000c0de'::uuid)$$,
  'an included child is required');
select lives_ok($$select private.accept_invite_impl('00000000-0000-0000-0000-0000000000e1',
  (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', '2026-10-07T08:00:00Z')).token,
  '2026-10-07T08:00:00Z')$$, 'Eve joins on Wednesday');
select ok(not exists (select 1 from public.habits h, private.required_members(h, '2026-10-05') r where h.id = '00000000-0000-0000-0000-0000000000d3' and r = '00000000-0000-0000-0000-0000000000e1'),
  'someone who joined mid-week is not required that week');
select ok(exists (select 1 from public.habits h, private.required_members(h, '2026-10-12') r where h.id = '00000000-0000-0000-0000-0000000000d3' and r = '00000000-0000-0000-0000-0000000000e1'),
  'but is required from the next week');
select lives_ok($$select private.check_in_impl('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000e1', '2026-10-07T18:00:00Z')$$,
  'a member who is not required can still check in');

-- Check-ins
select throws_ok($$select private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', '2026-10-05T18:00:00Z')$$,
  'P0002', 'keepup:habit_not_found', 'an outsider cannot check in on a group habit');
select is((private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '2026-10-05T18:00:00Z')).status,
  'approved', 'a check-in on a habit without approval counts at once');
select is((select logged_by from public.check_ins where habit_id = '00000000-0000-0000-0000-0000000000d1' and user_id = '00000000-0000-0000-0000-0000000000a1'),
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'an adult''s own check-in is logged by them');
select is(private.period_outcome(h, '2026-10-05'), 'missed', 'one of two adults is not enough')
  from public.habits h where h.id = '00000000-0000-0000-0000-0000000000d1';
select lives_ok($$select private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', '2026-10-05T19:00:00Z')$$, 'Dan checks in');
select is(private.period_outcome(h, '2026-10-05'), 'done', 'done when every required member has checked in')
  from public.habits h where h.id = '00000000-0000-0000-0000-0000000000d1';

-- Children: logged by an adult, or tapped in the kid view; never pending
select is((private.check_in_impl('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b1', '2026-10-05T18:00:00Z',
  '00000000-0000-0000-0000-00000000c0de')).logged_by, '00000000-0000-0000-0000-0000000000b1'::uuid, 'any adult logs for a child, and it records who');
select throws_ok($$select private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '2026-10-06T18:00:00Z',
  '00000000-0000-0000-0000-00000000c0de')$$, 'P0002', 'keepup:habit_not_found', 'a child not included cannot be checked in');
select throws_ok($$select private.check_in_impl('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c1', '2026-10-06T18:00:00Z',
  '00000000-0000-0000-0000-00000000c0de')$$, 'P0002', 'keepup:habit_not_found', 'an outsider cannot log for a child');
select is((private.check_in_impl('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a1', '2026-10-06T18:00:00Z',
  '00000000-0000-0000-0000-00000000c0de', true)).logged_by is null, true, 'a kid-view tap has no adult logger');
select throws_ok($$select private.check_in_impl('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a1', '2026-10-06T19:00:00Z',
  null, true)$$, 'P0001', 'keepup:not_a_child', 'only a child can tap in the kid view');

-- Undo: any adult may undo a child's check-in; nobody may undo another adult's
select lives_ok($$select private.undo_check_in_impl(
  (select id from public.check_ins where habit_id = '00000000-0000-0000-0000-0000000000d2' and local_date = '2026-10-06'),
  '00000000-0000-0000-0000-0000000000b1', '2026-10-06T20:00:00Z')$$, 'another adult undoes the child''s tap');
select throws_ok($$select private.undo_check_in_impl(
  (select id from public.check_ins where habit_id = '00000000-0000-0000-0000-0000000000d1' and user_id = '00000000-0000-0000-0000-0000000000a1'),
  '00000000-0000-0000-0000-0000000000b1', '2026-10-05T20:00:00Z')$$, 'P0002', 'keepup:check_in_not_found', 'an adult cannot undo another adult''s check-in');

-- Member pauses (decision 0006 + the spec's required-member rule)
select lives_ok($$select private.freeze_member_impl('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-0000000000b1', '2026-10-15', '2026-10-16', '2026-10-12T08:00:00Z')$$, 'Dan pauses himself Thursday–Friday');
select ok(not exists (select 1 from public.habits h, private.required_members(h, '2026-10-12') r where h.id = '00000000-0000-0000-0000-0000000000d3' and r = '00000000-0000-0000-0000-0000000000b1'),
  'a pause touching the week means he is not required that week');
select lives_ok($$select private.check_in_impl('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b1', '2026-10-13T18:00:00Z')$$,
  'he can still check in on a day that is not paused');
select throws_ok($$select private.check_in_impl('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b1', '2026-10-15T18:00:00Z')$$,
  'P0001', 'keepup:habit_frozen', 'but not on a paused day');
select lives_ok($$select private.check_in_impl('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a1', '2026-10-15T18:00:00Z')$$,
  'a member pause does not pause the habit for others');
select throws_ok($$select private.freeze_habit_impl('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b1', null, null, '2026-10-12T08:00:00Z')$$,
  'P0002', 'keepup:habit_not_found', 'a member cannot pause the whole group habit');

-- Outcomes of a group period
select is(private.period_outcome(h, '2026-10-19'), 'missed', 'a normal week with no check-ins is missed')
  from public.habits h where h.id = '00000000-0000-0000-0000-0000000000d3';

-- Week of 12 Oct: Anna (Thu) and Eve (Wed) checked in, Dan is paused, and a whole-habit pause on Saturday touches the week.
select lives_ok($$select private.check_in_impl('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000e1', '2026-10-14T18:00:00Z')$$,
  'Eve checks in Wednesday');
select lives_ok($$select private.freeze_habit_impl('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a1', '2026-10-17', '2026-10-17', '2026-10-14T19:00:00Z')$$,
  'the admin pauses the whole habit on Saturday');
select is(private.period_outcome(h, '2026-10-12'), 'done', 'a group period done while a pause touched it is done')
  from public.habits h where h.id = '00000000-0000-0000-0000-0000000000d3';

-- Week of 26 Oct: every required member is paused.
select lives_ok($$
  select private.freeze_member_impl('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', '2026-10-26', '2026-10-26', '2026-10-19T08:00:00Z');
  select private.freeze_member_impl('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', '2026-10-26', '2026-10-26', '2026-10-19T08:00:00Z');
  select private.freeze_member_impl('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e1', '2026-10-26', '2026-10-26', '2026-10-19T08:00:00Z')
$$, 'everyone pauses a day in the week of 26 Oct');
select is(private.period_outcome(h, '2026-10-26'), 'skipped', 'a group period where every required member is paused is skipped')
  from public.habits h where h.id = '00000000-0000-0000-0000-0000000000d3';

-- A whole-habit pause on a daily group habit.
select lives_ok($$select private.freeze_habit_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '2026-10-20', '2026-10-20', '2026-10-19T08:00:00Z')$$,
  'the admin pauses the family dinner on 20 Oct');
select is(private.period_outcome(h, '2026-10-20'), 'skipped', 'a whole-habit pause on a group habit makes the period skipped')
  from public.habits h where h.id = '00000000-0000-0000-0000-0000000000d1';

select * from finish();
rollback;
