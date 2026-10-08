-- supabase/tests/database/reset_my_data.test.sql
-- Settings → Reset my data (owner 2026-10-06): your private habits and their history, XP, levels,
-- badges and Inbox go; the account, settings, devices, groups, children and your part of group habits
-- stay. Nobody else's data changes.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

select tests.create_user('00000000-0000-0000-0000-0000000002a1', 'reset-anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000002b1', 'reset-dan@example.com', '{"full_name":"Dan"}');
update public.profiles set timezone = 'Europe/Rome', celebrations = 'subtle' where id = '00000000-0000-0000-0000-0000000002a1';

create temp table t (k text primary key, v uuid) on commit drop;
grant all on t to authenticated;

-- Family: Anna admin, Dan member, Mary is Anna's child.
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000002a1', 'Family', 'family')).id;
select private.accept_invite_impl('00000000-0000-0000-0000-0000000002b1',
  (private.create_invite_impl('00000000-0000-0000-0000-0000000002a1', (select v from t where k = 'fam'), now())).token, now());
insert into t select 'mary', private.create_child_impl('00000000-0000-0000-0000-0000000002a1', (select v from t where k = 'fam'), 'Mary', '🐼', 'sage', true);

-- Anna's private habit with history: a check-in, a settled day, a pause, a reminder setting.
set local session_replication_role = replica;
with h as (insert into public.habits (owner_id, title, category, emoji, target_count, period, starts_on, created_by)
           values ('00000000-0000-0000-0000-0000000002a1', 'Read', 'learning', '📚', 1, 'day', current_date - 3, '00000000-0000-0000-0000-0000000002a1') returning id)
  insert into t select 'read', id from h;
set local session_replication_role = origin;
select private.check_in_impl((select v from t where k = 'read'), '00000000-0000-0000-0000-0000000002a1', now());
insert into public.period_results (habit_id, period_start, outcome, finalized_at)
values ((select v from t where k = 'read'), current_date - 2, 'done', now());
insert into public.habit_freezes (habit_id, starts_on, ends_on) values ((select v from t where k = 'read'), current_date + 5, current_date + 6);
insert into public.habit_user_settings (user_id, habit_id, reminders) values ('00000000-0000-0000-0000-0000000002a1', (select v from t where k = 'read'), true);

-- A group habit both adults do, with a settled day; Mary's own habit.
insert into t select 'walk', (private.create_group_habit_impl('00000000-0000-0000-0000-0000000002a1', (select v from t where k = 'fam'),
  'Walk', '🚶', 'fitness', 1, 'day', null, false, array[]::uuid[], now())).id;
set local session_replication_role = replica;
update public.habits set starts_on = current_date - 3 where id = (select v from t where k = 'walk');
set local session_replication_role = origin;
select private.check_in_impl((select v from t where k = 'walk'), '00000000-0000-0000-0000-0000000002a1', now());
select private.check_in_impl((select v from t where k = 'walk'), '00000000-0000-0000-0000-0000000002b1', now());
insert into public.period_results (habit_id, period_start, outcome, finalized_at)
values ((select v from t where k = 'walk'), current_date - 2, 'done', now());
insert into t select 'brush', (private.create_child_habit_impl('00000000-0000-0000-0000-0000000002a1', (select v from t where k = 'mary'), 'Brush teeth', '🪥', 1, 'day', null)).id;
select private.check_in_impl((select v from t where k = 'brush'), '00000000-0000-0000-0000-0000000002a1', now(), (select v from t where k = 'mary'));

-- Anna's other per-person rows.
insert into public.level_ups (user_id, level) values ('00000000-0000-0000-0000-0000000002a1', 2) on conflict do nothing;
insert into public.dismissed_cards (user_id, card) values ('00000000-0000-0000-0000-0000000002a1', 'invite_family');
insert into public.notification_prefs (user_id, category, enabled, delivery) values ('00000000-0000-0000-0000-0000000002a1', 'achievements', true, 'sound');
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ('00000000-0000-0000-0000-0000000002a1', 'https://push.example.com/anna', 'k', 'a');
insert into public.recap_runs (user_id, kind, period_start, processed_at) values ('00000000-0000-0000-0000-0000000002a1', 'weekly_recap', current_date - 7, now());

create temp view mine as
  select (select count(*)::int from public.habits where owner_id = '00000000-0000-0000-0000-0000000002a1' and group_id is null) as habits,
         (select count(*)::int from public.xp_events where user_id = '00000000-0000-0000-0000-0000000002a1') as xp,
         (select count(*)::int from public.level_ups where user_id = '00000000-0000-0000-0000-0000000002a1') as levels,
         (select count(*)::int from public.user_achievements where user_id = '00000000-0000-0000-0000-0000000002a1') as badges,
         (select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000002a1') as inbox,
         (select count(*)::int from public.dismissed_cards where user_id = '00000000-0000-0000-0000-0000000002a1') as dismissed;
-- Everyone else's rows, to compare before and after.
create temp table others on commit drop as
  select 'xp' as k, user_id, count(*)::int as n from public.xp_events where user_id <> '00000000-0000-0000-0000-0000000002a1' group by user_id
  union all select 'badges', user_id, count(*)::int from public.user_achievements where user_id <> '00000000-0000-0000-0000-0000000002a1' group by user_id
  union all select 'inbox', user_id, count(*)::int from public.notifications where user_id <> '00000000-0000-0000-0000-0000000002a1' group by user_id
  union all select 'check_ins', user_id, count(*)::int from public.check_ins where user_id <> '00000000-0000-0000-0000-0000000002a1' group by user_id;
create temp table walk_before on commit drop as
  select (select row(current_streak, best_streak)::text from private.habit_streaks((select v from t where k = 'walk'), now())) as streak,
         (select count(*)::int from public.period_results where habit_id = (select v from t where k = 'walk')) as results;

select ok((select habits = 1 and xp > 0 and levels > 0 and badges > 0 and inbox > 0 and dismissed = 1 from mine),
  'before: a private habit, XP, a level, badges, Inbox rows and a dismissed card');

-- Who may call it
select ok(not has_function_privilege('anon', 'public.reset_my_data()', 'execute'), 'signed-out visitors cannot reset');
select ok(has_function_privilege('authenticated', 'public.reset_my_data()', 'execute'), 'a signed-in person can');
select throws_ok($$select public.reset_my_data()$$, '42501', 'keepup:not_authenticated', 'without a session it refuses');

-- Anna resets, as herself.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000002a1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.reset_my_data()$$, 'Anna resets her data');
select results_eq($$select xp, level from public.my_level()$$, $$values (0, 1)$$, 'XP 0, level 1');
reset role;

-- What's gone
select results_eq($$select habits, xp, levels, badges, inbox, dismissed from mine$$, $$values (0, 0, 0, 0, 0, 0)$$,
  'private habits, XP, levels, badges, Inbox and dismissed cards are gone');
select is((select count(*)::int from public.check_ins where habit_id = (select v from t where k = 'read')), 0, 'the private habit''s check-ins are gone');
select is((select count(*)::int from public.period_results where habit_id = (select v from t where k = 'read')), 0, 'its results are gone');
select is((select count(*)::int from public.habit_freezes where habit_id = (select v from t where k = 'read'))
          + (select count(*)::int from public.habit_user_settings where habit_id = (select v from t where k = 'read')), 0,
  'its pause and its settings are gone');

-- What stays
select results_eq($$select display_name, timezone, celebrations from public.profiles where id = '00000000-0000-0000-0000-0000000002a1'$$,
  $$values ('Anna'::text, 'Europe/Rome'::text, 'subtle'::text)$$, 'the account and profile settings stay');
select is((select delivery from public.notification_prefs where user_id = '00000000-0000-0000-0000-0000000002a1' and category = 'achievements'),
  'sound', 'notification settings stay');
select is((select count(*)::int from public.push_subscriptions where user_id = '00000000-0000-0000-0000-0000000002a1'), 1, 'devices stay');
select is((select role from public.group_members where user_id = '00000000-0000-0000-0000-0000000002a1' and group_id = (select v from t where k = 'fam')),
  'admin', 'the group and Anna''s membership stay');
select is((select count(*)::int from public.check_ins where habit_id = (select v from t where k = 'walk') and user_id = '00000000-0000-0000-0000-0000000002a1'), 1,
  'Anna''s check-in in the group habit stays (group history)');
select is((select count(*)::int from public.recap_runs where user_id = '00000000-0000-0000-0000-0000000002a1'), 1,
  'the recap "already sent" marks stay, so no recap is sent twice');

-- The group habit still shows Anna's past check-ins, and its results and streak don't change.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000002b1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.check_ins where habit_id = (select v from t where k = 'walk') and user_id = '00000000-0000-0000-0000-0000000002a1'), 1,
  'Dan still sees Anna''s check-in on the group habit');
reset role;
select results_eq($$select (select row(current_streak, best_streak)::text from private.habit_streaks((select v from t where k = 'walk'), now())),
                          (select count(*)::int from public.period_results where habit_id = (select v from t where k = 'walk'))$$,
  $$select streak, results from walk_before$$, 'the group habit''s results and streak are unchanged');

-- Nobody else changes: Dan, and Mary (a child: she has Reset child).
select set_eq($$select k, user_id, n from others$$,
  $$select 'xp', user_id, count(*)::int from public.xp_events where user_id <> '00000000-0000-0000-0000-0000000002a1' group by user_id
    union all select 'badges', user_id, count(*)::int from public.user_achievements where user_id <> '00000000-0000-0000-0000-0000000002a1' group by user_id
    union all select 'inbox', user_id, count(*)::int from public.notifications where user_id <> '00000000-0000-0000-0000-0000000002a1' group by user_id
    union all select 'check_ins', user_id, count(*)::int from public.check_ins where user_id <> '00000000-0000-0000-0000-0000000002a1' group by user_id$$,
  'everyone else''s XP, badges, Inbox and check-ins are unchanged');
select ok((select count(*) from others where user_id = (select v from t where k = 'mary') and k = 'xp') = 1, 'Mary had XP to keep (the check above means something)');
select is((select count(*)::int from public.habits where id = (select v from t where k = 'brush')), 1, 'Mary''s own habit stays');
select is((select count(*)::int from public.profiles where id = (select v from t where k = 'mary')), 1, 'Mary stays');

-- Again: nothing left to clear.
select lives_ok($$select private.reset_my_data_impl('00000000-0000-0000-0000-0000000002a1', now())$$, 'a second reset is fine');
select results_eq($$select habits, xp, levels, badges, inbox, dismissed from mine$$, $$values (0, 0, 0, 0, 0, 0)$$, 'and changes nothing');

select * from finish();
rollback;
