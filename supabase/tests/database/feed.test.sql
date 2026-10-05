begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');
select tests.create_user('00000000-0000-0000-0000-0000000000e1', 'eve@example.com', '{"full_name":"Eve"}');

create temp table t (k text primary key, v uuid) on commit drop;
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Family', 'family')).id;
insert into t select 'inv', (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), now())).id;
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000b1', (select token from public.group_invites where id = (select v from t where k = 'inv')), now());

select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'member_joined'),
  1, 'the admin hears that Dan joined');

insert into t select 'dinner', (private.create_group_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'),
  'Family dinner', '🍽️', 'people', 1, 'day', null, false, '{}', now())).id;
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'group_habit_created'),
  1, 'other members hear about a new group habit');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'group_habit_created'),
  0, 'the creator does not notify themselves');

-- #1 and #10: check-ins and "Everyone did it", exactly once per member
select private.check_in_impl((select v from t where k = 'dinner'), '00000000-0000-0000-0000-0000000000a1', now());
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'group_check_in'),
  1, 'Dan sees Anna''s check-in');
select is((select count(*)::int from public.notifications where user_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1') and kind = 'everyone_done'), 0, 'not everyone yet');
select private.check_in_impl((select v from t where k = 'dinner'), '00000000-0000-0000-0000-0000000000b1', now());
select is((select count(*)::int from public.notifications where user_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1') and kind = 'everyone_done'), 2, 'the last check-in tells each member once');
select private.undo_check_in_impl((select id from public.check_ins where user_id = '00000000-0000-0000-0000-0000000000b1'), '00000000-0000-0000-0000-0000000000b1', now());
select private.check_in_impl((select v from t where k = 'dinner'), '00000000-0000-0000-0000-0000000000b1', now());
select is((select count(*)::int from public.notifications where user_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1') and kind = 'everyone_done'), 2, 'undo and redo do not repeat it');
select ok(not exists (select 1 from public.notifications where user_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1') and kind = 'everyone_done' and payload::text ~* '(anna|dan)'),
  'group messages never name anyone');

-- #2, #4, #5: approvals
set local session_replication_role = replica;
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, requires_approval, created_at, created_by)
values ('00000000-0000-0000-0000-0000000000d9', null, (select v from t where k = 'fam'), 'Gym', 'fitness', '🏋️', 1, 'day', current_date - 30, 1, true, now() - interval '30 days', '00000000-0000-0000-0000-0000000000a1');
update public.group_members set joined_at = now() - interval '31 days' where group_id = (select v from t where k = 'fam');
set local session_replication_role = origin;
insert into t select 'gymci', (private.check_in_impl('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b1', now())).id;
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'approval_needed'),
  1, 'the other member is asked to approve');
select private.review_check_in_impl((select v from t where k = 'gymci'), '00000000-0000-0000-0000-0000000000a1', false, now());
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'check_in_rejected'),
  1, 'the author hears it was not approved');

-- Nudges: presets only, once per day, only someone who still needs to check in
select throws_ok($$select private.nudge_impl('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b1', 'hurry', now())$$,
  '23514', null, 'only the three preset kinds exist');
select lives_ok($$select private.nudge_impl('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b1', 'you_got_this', now())$$,
  'Anna nudges Dan on Gym (his check-in was not approved)');
select throws_ok($$select private.nudge_impl('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b1', 'gentle_reminder', now())$$,
  'P0001', 'keepup:already_nudged', 'one nudge per person, habit and day');
select throws_ok($$select private.nudge_impl('00000000-0000-0000-0000-0000000000b1', (select v from t where k = 'dinner'), '00000000-0000-0000-0000-0000000000a1', 'thinking_of_you', now())$$,
  'P0001', 'keepup:cannot_nudge', 'no nudging someone who already checked in today');
select is((select payload ->> 'kind' from public.notifications where user_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1') and kind = 'nudge'), 'you_got_this', 'the recipient gets the preset');

-- Cheers
select throws_ok($$select private.cheer_impl('00000000-0000-0000-0000-0000000000a1', (select id from public.check_ins where habit_id = (select v from t where k = 'dinner') and user_id = '00000000-0000-0000-0000-0000000000a1'))$$,
  'P0001', 'keepup:cannot_cheer', 'nobody cheers their own check-in');
select lives_ok($$select private.cheer_impl('00000000-0000-0000-0000-0000000000b1', (select id from public.check_ins where habit_id = (select v from t where k = 'dinner') and user_id = '00000000-0000-0000-0000-0000000000a1'))$$,
  'Dan cheers Anna');
select lives_ok($$select private.cheer_impl('00000000-0000-0000-0000-0000000000b1', (select id from public.check_ins where habit_id = (select v from t where k = 'dinner') and user_id = '00000000-0000-0000-0000-0000000000a1'))$$,
  'cheering twice is harmless');
select is((select count(*)::int from public.notifications where user_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1') and kind = 'cheer'), 1, 'and Anna hears it once');

delete from public.notifications where user_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1') and kind = 'cheer';
select private.cheer_impl('00000000-0000-0000-0000-0000000000b1', (select id from public.check_ins where habit_id = (select v from t where k = 'dinner') and user_id = '00000000-0000-0000-0000-0000000000a1'));
select is((select count(*)::int from public.notifications where user_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1') and kind = 'cheer'), 0, 'a repeat cheer after the feed purge does not notify again');

-- Pending approvals: the other member sees it; the author, an outsider and a closed window do not
select private.check_in_impl('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b1', now());
select is((select count(*)::int from private.pending_approvals_impl('00000000-0000-0000-0000-0000000000a1', now())
            where author_id = '00000000-0000-0000-0000-0000000000b1' and author_name = 'Dan' and group_name = 'Family'),
  1, 'the other member sees the pending check-in, with names');
select is((select count(*)::int from private.pending_approvals_impl('00000000-0000-0000-0000-0000000000b1', now())),
  0, 'the author does not review their own check-in');
select is((select count(*)::int from private.pending_approvals_impl('00000000-0000-0000-0000-0000000000e1', now())),
  0, 'an outsider sees nothing');
select is((select count(*)::int from private.pending_approvals_impl('00000000-0000-0000-0000-0000000000a1', now() + interval '3 days')),
  0, 'a closed review window drops out');

-- #9 and group milestones: from finalized periods, never naming anyone
set local session_replication_role = replica;
insert into public.period_results (habit_id, period_start, outcome) values
  ('00000000-0000-0000-0000-0000000000d9', current_date - 6, 'done'),
  ('00000000-0000-0000-0000-0000000000d9', current_date - 5, 'done');
set local session_replication_role = origin;
insert into public.period_results (habit_id, period_start, outcome) values
  ('00000000-0000-0000-0000-0000000000d9', current_date - 4, 'skipped'),
  ('00000000-0000-0000-0000-0000000000d9', current_date - 3, 'done');
select is((select count(*)::int from public.notifications where user_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1') and kind = 'group_milestone'), 0,
  'a 3-day run (a paused day passed over) is not on the milestone schedule');
insert into public.period_results (habit_id, period_start, outcome) values ('00000000-0000-0000-0000-0000000000d9', current_date - 2, 'missed');
select is((select (payload ->> 'streak')::int from public.notifications where user_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1') and kind = 'group_streak_ended' and user_id = '00000000-0000-0000-0000-0000000000b1'),
  3, 'a missed day ends the group streak and says how long it was, without names');
insert into public.period_results (habit_id, period_start, outcome) values ((select v from t where k = 'dinner'), current_date - 1, 'done');
select is((select (payload ->> 'streak')::int from public.notifications where user_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1') and kind = 'group_milestone' and habit_id = (select v from t where k = 'dinner') limit 1),
  1, 'the first done period is milestone 1 (first day together)');

-- RLS and read state
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select ok((select bool_and(user_id = '00000000-0000-0000-0000-0000000000b1') from public.notifications), 'each person reads only their own feed');
select ok((select count(*) from public.inbox_feed(200)) > 0, 'the inbox has rows');
select is((select count(*) from public.inbox_feed(200)), (select count(*) from public.notifications),
  'the inbox returns only the caller''s rows');
select is((select actor_name || ' / ' || group_name || ' / ' || habit_title from public.inbox_feed(200) where kind = 'group_check_in' limit 1),
  'Anna / Family / Family dinner', 'names, group and habit are joined in');
select ok((select count(*) from public.inbox_feed(null)) > 0, 'a null limit falls back to the default');
select is(public.mark_feed_seen(array(select id from public.notifications where user_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1') and kind = 'everyone_done')), 1, 'marking a celebration seen');
select is(public.mark_feed_seen(array(select id from public.notifications where user_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1') and kind = 'everyone_done')), 0, 'only once');
select ok(public.mark_feed_read() > 0, 'marking all read');
select is((select count(*)::int from public.notifications where read_at is null), 0, 'leaves nothing unread');
reset role;

select ok(not has_function_privilege('anon', 'public.inbox_feed(int)', 'execute'), 'anon cannot read a feed');
select ok(not has_function_privilege('anon', 'public.nudge(uuid, uuid, text)', 'execute'), 'anon cannot nudge');
select ok(not has_function_privilege('anon', 'public.cheer(uuid)', 'execute'), 'anon cannot cheer');

-- Pauses, a kid check-in, then deleting the whole group: no feed trigger may insert a row that
-- references something the cascade is removing.
select private.freeze_habit_impl((select v from t where k = 'dinner'), '00000000-0000-0000-0000-0000000000a1', current_date + 1, current_date + 3, now());
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'group_habit_paused'),
  1, 'members hear a group habit was paused');
select private.freeze_member_impl('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', current_date + 1, current_date + 2, now());
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'member_paused'),
  1, 'members hear someone paused themselves');
insert into t select 'kid', private.create_child_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), 'Mia', '🦊', 'peach', true);
insert into t select 'kidhabit', (private.create_child_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'kid'), 'Brush teeth', '🪥', 1, 'day', null)).id;
select private.check_in_impl((select v from t where k = 'kidhabit'), '00000000-0000-0000-0000-0000000000a1', now(), (select v from t where k = 'kid'));
select is((select count(*)::int from public.notifications where user_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1') and kind = 'kid_check_in' and user_id = '00000000-0000-0000-0000-0000000000b1'),
  1, 'the other adult sees the kid check-in, feed only');
select lives_ok($$select private.delete_group_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), true)$$,
  'deleting a group with habits, pauses, check-ins, a child and members succeeds');
-- Achievements rows (M5: level-ups, badges, milestones, recaps) are about the person, not the group, so they stay.
select is((select count(*)::int from public.notifications where user_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1')
            and private.push_category(kind) is distinct from 'achievements'), 0, 'and takes its feed with it');

select * from finish();
rollback;
