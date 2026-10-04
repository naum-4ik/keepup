-- supabase/tests/database/push_events.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');
select tests.create_user('00000000-0000-0000-0000-0000000000c1', 'grandma@example.com', '{"full_name":"Grandma"}');

create temp table t (k text primary key, v uuid) on commit drop;
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Family', 'family')).id;
insert into t select 'inv', (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), now())).id;
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000b1', (select token from public.group_invites where id = (select v from t where k = 'inv')), now());
insert into t select 'dinner', (private.create_group_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'),
  'Family dinner', '🍽️', 'people', 1, 'day', null, false, '{}', now())).id;
set local session_replication_role = replica;
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, requires_approval, created_at, created_by)
values ('00000000-0000-0000-0000-0000000000d9', null, (select v from t where k = 'fam'), 'Gym', 'fitness', '🏋️', 1, 'day', current_date - 30, 1, true,
        now() - interval '30 days', '00000000-0000-0000-0000-0000000000a1');
update public.group_members set joined_at = now() - interval '31 days' where group_id = (select v from t where k = 'fam');
set local session_replication_role = origin;

-- #1 and #10
select private.check_in_impl((select v from t where k = 'dinner'), '00000000-0000-0000-0000-0000000000a1', now());
select ok((select push and category = 'group_activity' from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'group_check_in'),
  '#1 a group check-in is pushed under Group activity');
select isnt(public.push_job((select id from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'group_check_in'), now()), null,
  'a non-final check-in''s group_check_in is a normal job');
select private.check_in_impl((select v from t where k = 'dinner'), '00000000-0000-0000-0000-0000000000b1', now());
select is((select count(*)::int from public.notifications where kind = 'everyone_done' and push and habit_id = (select v from t where k = 'dinner')), 2, '#10 Everyone did it is pushed to each member');
select ok((select bool_and(public.push_job(id, now()) is null) from public.notifications where kind = 'group_check_in' and habit_id = (select v from t where k = 'dinner')),
  'once everyone is done the group_check_in jobs are skipped');
select ok((select bool_and(pushed_at is not null) from public.notifications where kind = 'group_check_in' and habit_id = (select v from t where k = 'dinner')),
  'and marked sent');
select isnt(public.push_job((select id from public.notifications where kind = 'everyone_done' and user_id = '00000000-0000-0000-0000-0000000000a1'), now()), null,
  'while Everyone did it is a normal job');

-- #2, #4, #5
insert into t select 'gym1', (private.check_in_impl('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b1', now())).id;
select ok((select push and category = 'approvals' from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'approval_needed'),
  '#2 a check-in waiting for approval is pushed under Approvals');
select private.review_check_in_impl((select v from t where k = 'gym1'), '00000000-0000-0000-0000-0000000000a1', false, now());
select ok((select push and category = 'always' from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'check_in_rejected'),
  '#4 "not approved" is always pushed');
insert into t select 'gym2', (private.check_in_impl('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b1', now())).id;
select private.review_check_in_impl((select v from t where k = 'gym2'), '00000000-0000-0000-0000-0000000000a1', true, now());
select ok((select not push from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'check_in_approved'),
  '#5 approved stays in the feed only');

-- #7 and kid routine check-ins: feed only; kid special moments: pushed
select private.cheer_impl('00000000-0000-0000-0000-0000000000a1',
  (select id from public.check_ins where habit_id = (select v from t where k = 'dinner') and user_id = '00000000-0000-0000-0000-0000000000b1'));
select ok((select not push from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'cheer'), '#7 a cheer is feed only');
insert into t select 'mary', private.create_child_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), 'Mary', '🐼', 'peach', true);
insert into t select 'brush', (private.create_child_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'mary'), 'Brush teeth', '🪥', 1, 'day', null)).id;
select private.check_in_impl((select v from t where k = 'brush'), '00000000-0000-0000-0000-0000000000a1', now(), (select v from t where k = 'mary'));
select ok((select not push from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'kid_check_in'),
  'a kid''s routine check-in is feed only');
select ok((select bool_and(private.push_allowed('00000000-0000-0000-0000-0000000000b1', k, null, (select v from t where k = 'fam'), '{}', now()))
             from unnest(array['kid_goal_reached', 'kid_garden_full', 'kid_streak']) k),
  'the three kid special moments are pushed');

-- #15: admins get the push, everyone the feed
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000c1', (select token from public.group_invites where id = (select v from t where k = 'inv')), now());
select ok((select push from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'member_joined'
            and actor_id = '00000000-0000-0000-0000-0000000000c1'), '#15 the admin is pushed that Grandma joined');
select ok((select not push from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'member_joined'
            and actor_id = '00000000-0000-0000-0000-0000000000c1'), 'a member sees it in the feed only');

-- #12, #13
insert into t select 'walk', (private.create_group_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'),
  'Walk together', '🚶', 'people', 1, 'day', null, false, '{}', now())).id;
select ok((select push and category = 'group_updates' from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'group_habit_created'
            and habit_id = (select v from t where k = 'walk')),
  '#12 a new group habit is pushed under Group updates');
select ok((select bool_and(private.push_allowed('00000000-0000-0000-0000-0000000000b1', k, (select v from t where k = 'walk'), (select v from t where k = 'fam'), '{}', now()))
             from unnest(array['group_habit_paused', 'group_habit_resumed']) k),
  '#13 paused and resumed are pushed');

select ok(not private.push_allowed('00000000-0000-0000-0000-0000000000b1', 'group_streak_ended', null, (select v from t where k = 'fam'), '{}', now())
          and not private.push_allowed('00000000-0000-0000-0000-0000000000b1', 'group_streak_ended', null, (select v from t where k = 'fam'), '{"streak": "x"}', now()),
  '#9 a missing or non-integer streak is feed only, without an error');

-- #9: pushed only from a 3-period streak, never naming anyone
select ok(not private.push_allowed('00000000-0000-0000-0000-0000000000b1', 'group_streak_ended', (select v from t where k = 'dinner'), (select v from t where k = 'fam'), '{"streak": 2}', now()),
  '#9 a 2-day streak ending is feed only');
set local session_replication_role = replica;
insert into public.period_results (habit_id, period_start, outcome) values
  ((select v from t where k = 'dinner'), current_date - 5, 'done'),
  ((select v from t where k = 'dinner'), current_date - 4, 'done'),
  ((select v from t where k = 'dinner'), current_date - 3, 'done');
set local session_replication_role = origin;
insert into public.period_results (habit_id, period_start, outcome) values ((select v from t where k = 'dinner'), current_date - 2, 'missed');
select ok((select push from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'group_streak_ended'),
  '#9 from 3 it is pushed');

select ok(private.push_allowed('00000000-0000-0000-0000-0000000000b1', 'streak_back', (select v from t where k = 'dinner'), (select v from t where k = 'fam'), '{}', now())
          and not private.push_allowed('00000000-0000-0000-0000-0000000000a1', 'streak_back', null, null, '{}', now()),
  '"streak is back" is pushed for a group, feed only for a private habit');

select ok(not (select bool_or(private.push_allowed('00000000-0000-0000-0000-0000000000b1', k, (select v from t where k = 'dinner'), (select v from t where k = 'fam'), '{}', now()))
                 from unnest(array['group_habit_archived', 'member_paused', 'member_left', 'role_changed',
                                   'private_streak_ended', 'already_logged', 'sync_dropped', 'undo_dropped']) k),
  'the feed-only events stay feed-only (a group milestone is pushed since 20261008100000: m4_followups.test.sql)');

-- Mutes still win
select private.set_habit_mute_impl('00000000-0000-0000-0000-0000000000b1', (select v from t where k = 'walk'), true);
select private.set_notification_pref_impl('00000000-0000-0000-0000-0000000000c1', 'group_activity', false);
select private.check_in_impl((select v from t where k = 'walk'), '00000000-0000-0000-0000-0000000000a1', now());
select ok((select not push from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'group_check_in'
            and habit_id = (select v from t where k = 'walk')), 'a muted habit''s group check-ins are not pushed');
select ok((select not push from public.notifications where user_id = '00000000-0000-0000-0000-0000000000c1' and kind = 'group_check_in'
            and habit_id = (select v from t where k = 'walk')), 'nor with Group activity turned off');

-- PR 6 mappings survive
select is((select array_agg(private.push_category(k) order by k) from unnest(array['daily_summary', 'habit_reminder', 'approval_expiring']) k),
  array['approvals', 'reminders', 'reminders'], 'PR 6 kinds keep their categories (approval_expiring is Approvals)');

select * from finish();
rollback;
