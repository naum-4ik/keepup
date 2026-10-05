-- supabase/tests/database/xp.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(52);

-- finalize_periods scans every habit; start from none (rolled back at the end).
delete from public.habits;

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');
select tests.create_user('00000000-0000-0000-0000-0000000000e1', 'eve@example.com', '{"full_name":"Eve"}');
select tests.create_user('00000000-0000-0000-0000-0000000000f1', 'fay@example.com', '{"full_name":"Fay"}');
select tests.create_user('00000000-0000-0000-0000-0000000000c1', 'gus@example.com', '{"full_name":"Gus"}');
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
  ('00000000-0000-0000-0000-0000000000d2', null, (select v from t where k = 'fam'), 'Gym', 'fitness', '🏋️', 1, 'day', '2026-10-01', 1, true,
   '2026-10-01 08:00+02', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000d3', (select v from t where k = 'mary'), null, 'Brush teeth', null, '🪥', 1, 'day', '2026-10-01', 1, false,
   '2026-10-01 08:00+02', '00000000-0000-0000-0000-0000000000a1');
set local session_replication_role = origin;
create temp view xp as select x.* from public.xp_events x;

-- A. Check-ins: +10 when counted, a negative row on undo.
insert into t select 'c1', (private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '2026-10-01 09:00+02')).id;
select is((select sum(amount)::int from xp where user_id = '00000000-0000-0000-0000-0000000000a1'), 10, 'a counted check-in earns 10');
select is((select source_id from xp where reason = 'check_in' and user_id = '00000000-0000-0000-0000-0000000000a1'), (select v::text from t where k = 'c1'),
  'keyed by the check-in');
select private.undo_check_in_impl((select v from t where k = 'c1'), '00000000-0000-0000-0000-0000000000a1', '2026-10-01 10:00+02');
select is((select sum(amount)::int from xp where user_id = '00000000-0000-0000-0000-0000000000a1'), 0, 'undo takes the 10 back');
select is((select amount from xp where reason = 'check_in_undone' and source_id = (select v::text from t where k = 'c1')), -10,
  'with a negative row: the ledger keeps both');
select private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '2026-10-01 11:00+02');
select is((select sum(amount)::int from xp where user_id = '00000000-0000-0000-0000-0000000000a1'), 10, 'checking in again earns it again');

-- B. Approval: nothing while pending; the author +10 and the reviewer +2 on approval; nothing when not approved.
insert into t select 'g1', (private.check_in_impl('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b1', '2026-10-01 09:00+02')).id;
select is((select coalesce(sum(amount), 0)::int from xp where user_id = '00000000-0000-0000-0000-0000000000b1'), 0, 'a pending check-in earns nothing yet');
select private.review_check_in_impl((select v from t where k = 'g1'), '00000000-0000-0000-0000-0000000000a1', true, '2026-10-01 10:00+02');
select is((select sum(amount)::int from xp where user_id = '00000000-0000-0000-0000-0000000000b1'), 10, 'approved: the author gets 10');
select is((select amount from xp where user_id = '00000000-0000-0000-0000-0000000000a1' and reason = 'approval'), 2, 'and the reviewer 2');
insert into t select 'g2', (private.check_in_impl('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a1', '2026-10-01 09:30+02')).id;
select private.review_check_in_impl((select v from t where k = 'g2'), '00000000-0000-0000-0000-0000000000b1', true, '2026-10-01 10:30+02');
insert into t select 'g3', (private.check_in_impl('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b1', '2026-10-02 09:00+02')).id;
select private.review_check_in_impl((select v from t where k = 'g3'), '00000000-0000-0000-0000-0000000000a1', false, '2026-10-02 10:00+02');
select is((select count(*)::int from xp where source_id = (select v::text from t where k = 'g3')), 0, 'a check-in that wasn''t approved earns nothing');

-- C. Kids earn behind the scenes.
select private.check_in_impl('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a1', '2026-10-01 19:00+02', (select v from t where k = 'mary'));
select is((select amount from xp where user_id = (select v from t where k = 'mary') and reason = 'check_in'), 10, 'a child''s check-in earns the child 10');
select ok(not exists (select 1 from xp where user_id = '00000000-0000-0000-0000-0000000000a1' and habit_id = '00000000-0000-0000-0000-0000000000d3'),
  'not the adult who logged it');

-- D. Periods: +20 private, +30 group to each required member, once.
select private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '2026-10-02 09:00+02');
select private.finalize_periods('2026-10-03 13:00+02');
select is((select sum(amount)::int from xp where user_id = '00000000-0000-0000-0000-0000000000a1' and reason = 'period_done' and habit_id = '00000000-0000-0000-0000-0000000000d1'),
  40, 'each done private day adds 20 at finalization');
select is((select array_agg(amount order by user_id) from xp where reason = 'period_done' and source_id = '00000000-0000-0000-0000-0000000000d2:2026-10-01'),
  array[30, 30], 'a done group day pays 30 to each required member');
select is((select count(*)::int from xp where reason = 'period_done' and source_id = '00000000-0000-0000-0000-0000000000d2:2026-10-02'), 0,
  'a missed day pays nothing');
select is((select amount from xp where reason = 'period_done' and user_id = (select v from t where k = 'mary')), 20, 'the child''s own done day too');
select is(private.finalize_periods('2026-10-03 13:00+02'), 0, 'finalizing again settles nothing');
select is((select count(*)::int from xp where reason = 'period_done'), 5, 'and grants nothing (Read ×2, Gym ×2, Brush teeth ×1)');

-- E. A late tap that resettles missed → done pays the period XP once.
select private.finalize_periods('2026-10-04 01:00+02');
select is((select outcome from public.period_results where habit_id = '00000000-0000-0000-0000-0000000000d1' and period_start = '2026-10-03'), 'missed', 'setup: 3 Oct missed');
select private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '2026-10-04 09:00+02',
  null, false, 'c0000000-0000-0000-0000-0000000000e1', '2026-10-03 20:00+02');
select is((select outcome from public.period_results where habit_id = '00000000-0000-0000-0000-0000000000d1' and period_start = '2026-10-03'), 'done', 'the late tap upgraded it');
select is((select count(*)::int from xp where reason = 'period_done' and source_id = '00000000-0000-0000-0000-0000000000d1:2026-10-03'), 1,
  'a late tap that resettles missed → done pays the period XP once');

-- F. Levels: boundaries, one row per jump, undo keeps the row, re-crossing writes nothing new.
select is(array[private.level_for(0), private.level_for(49), private.level_for(50), private.level_for(199), private.level_for(200), private.level_for(449), private.level_for(450), private.level_for(-5)],
  array[1, 1, 2, 2, 3, 3, 4, 1], 'level = floor(sqrt(xp / 50)) + 1, never below 1');
select ok(private.grant_xp('00000000-0000-0000-0000-0000000000e1', 45, 'check_in', 'check_in', 'e-1'), 'a new grant says so');
select ok(not private.grant_xp('00000000-0000-0000-0000-0000000000e1', 45, 'check_in', 'check_in', 'e-1'), 'the same grant twice is refused');
select is((select count(*)::int from public.level_ups where user_id = '00000000-0000-0000-0000-0000000000e1'), 0, 'under 50: still level 1');
select private.grant_xp('00000000-0000-0000-0000-0000000000e1', 10, 'check_in', 'check_in', 'e-2');
select is((select array_agg(level) from public.level_ups where user_id = '00000000-0000-0000-0000-0000000000e1'), array[2], 'crossing 50 writes level 2');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000000e1' and kind = 'level_up'), 1, 'and one Inbox row');
select ok((select not push from public.notifications where user_id = '00000000-0000-0000-0000-0000000000e1' and kind = 'level_up'),
  'Achievements is Inbox only by default (no preference row)');
select private.grant_xp('00000000-0000-0000-0000-0000000000e1', -10, 'check_in_undone', 'check_in', 'e-2');
select ok(exists (select 1 from public.level_ups where user_id = '00000000-0000-0000-0000-0000000000e1' and level = 2), 'undo below a boundary keeps the level_ups row');
select private.grant_xp('00000000-0000-0000-0000-0000000000e1', 10, 'check_in', 'check_in', 'e-3');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000000e1' and kind = 'level_up'), 1,
  're-crossing writes no second level_up row');
select private.set_notification_delivery_impl('00000000-0000-0000-0000-0000000000e1', 'achievements', 'silent');
select private.grant_xp('00000000-0000-0000-0000-0000000000e1', 1000, 'milestone', 'streak', 'e-big');
select is((select array_agg(level order by level) from public.level_ups where user_id = '00000000-0000-0000-0000-0000000000e1'), array[2, 3, 4, 5],
  'a big jump writes every level it passes');
select is((select array_agg(payload ->> 'level' order by created_at, payload ->> 'level') from public.notifications
            where user_id = '00000000-0000-0000-0000-0000000000e1' and kind = 'level_up'), array['2', '5'], 'but one Inbox row per jump, for the top level');
select ok((select push from public.notifications where user_id = '00000000-0000-0000-0000-0000000000e1' and kind = 'level_up' and payload ->> 'level' = '5'),
  'with Achievements on Silent, a level-up pushes');
select private.grant_xp((select v from t where k = 'mary'), 50, 'check_in', 'check_in', 'kid-extra');
select ok(exists (select 1 from public.level_ups where user_id = (select v from t where k = 'mary') and level = 2), 'a child levels up behind the scenes');
select is((select count(*)::int from public.notifications where user_id = (select v from t where k = 'mary')), 0, 'with no Inbox row');

-- F2. Achievements defaults to Inbox only; every other category keeps Silent (PR 1 review gate).
select is(array[private.push_category('level_up'), private.push_category('badge_unlocked'), private.push_category('streak_milestone'),
                private.push_category('rest_day_used'), private.push_category('weekly_recap'), private.push_category('monthly_recap'),
                private.push_category('family_recap')],
  array['achievements', 'achievements', 'achievements', 'achievements', 'achievements', 'achievements', 'group_updates'],
  'every M5 kind has its push category; the family recap is Group updates');
select ok(not private.push_allowed('00000000-0000-0000-0000-0000000000f1', 'weekly_recap', null, null, '{}', now()),
  'no preference row: Achievements doesn''t push');
select ok(private.push_allowed('00000000-0000-0000-0000-0000000000f1', 'nudge', null, null, '{}', now()),
  'no preference row: other categories still push (Silent)');
select ok(private.push_allowed('00000000-0000-0000-0000-0000000000f1', 'family_recap', null, null, '{}', now()),
  'no preference row: the family recap pushes under Group updates');
select is(private.push_job_build((select id from public.notifications where user_id = '00000000-0000-0000-0000-0000000000e1'
                                   and kind = 'level_up' and payload ->> 'level' = '5')) ->> 'silent', 'true',
  'Achievements on Silent pushes silently');
select private.set_notification_delivery_impl('00000000-0000-0000-0000-0000000000c1', 'achievements', 'sound');
select private.grant_xp('00000000-0000-0000-0000-0000000000c1', 50, 'check_in', 'check_in', 'g-1');
select ok((select push from public.notifications where user_id = '00000000-0000-0000-0000-0000000000c1' and kind = 'level_up'),
  'Achievements on Sound: a level-up pushes');
select is(private.push_job_build((select id from public.notifications where user_id = '00000000-0000-0000-0000-0000000000c1'
                                   and kind = 'level_up')) ->> 'silent', 'false', 'with sound');

-- G. The ledger is append-only and private.
select throws_ok($$update public.xp_events set amount = 99 where user_id = '00000000-0000-0000-0000-0000000000e1'$$,
  'P0001', 'keepup:ledger_append_only', 'no row is ever changed');
select tests.authenticate_as('00000000-0000-0000-0000-0000000000e1');
select is((select count(*)::int from public.xp_events where user_id <> '00000000-0000-0000-0000-0000000000e1'), 0, 'Eve reads only her own XP');
select is((select row(xp, level)::text from public.my_level()), '(1055,5)', 'my_level: total and level');
select is(public.mark_levels_seen(5), 4, 'mark_levels_seen marks every level up to the one shown');
select throws_ok($$insert into public.xp_events (user_id, amount, reason, source_type, source_id) values ('00000000-0000-0000-0000-0000000000e1', 5, 'check_in', 'check_in', 'x')$$,
  '42501', null, 'XP is written only by the database');
reset role;

-- H. Reset a child and delete an account.
select private.reset_child_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'mary'));
select is((select count(*)::int from public.xp_events where user_id = (select v from t where k = 'mary'))
        + (select count(*)::int from public.level_ups where user_id = (select v from t where k = 'mary')), 0, 'reset clears the child''s XP and levels');
select lives_ok($$delete from auth.users where id = '00000000-0000-0000-0000-0000000000b1'$$, 'deleting an account with check-ins and XP works');

-- I. Backfill: past history, quietly, once.
set local session_replication_role = replica;
insert into public.habits (id, owner_id, title, category, emoji, target_count, period, starts_on, week_start, created_at, created_by)
values ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000f1', 'Walk', 'fitness', '👟', 1, 'day', '2026-09-01', 1,
        '2026-09-01 08:00Z', '00000000-0000-0000-0000-0000000000f1');
insert into public.check_ins (habit_id, user_id, local_date, period_start, status, created_at, logged_by)
select '00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000f1', d, d, 'approved', d + time '09:00', '00000000-0000-0000-0000-0000000000f1'
  from (values (date '2026-09-01'), (date '2026-09-02'), (date '2026-09-03')) v(d);
insert into public.period_results (habit_id, period_start, outcome, finalized_at) values
  ('00000000-0000-0000-0000-0000000000d4', '2026-09-01', 'done', '2026-09-02 00:15Z'),
  ('00000000-0000-0000-0000-0000000000d4', '2026-09-02', 'done', '2026-09-03 00:15Z');
set local session_replication_role = origin;
select private.backfill_xp();
select is((select sum(amount)::int from public.xp_events where user_id = '00000000-0000-0000-0000-0000000000f1'), 70, 'backfill: 3 check-ins and 2 done days');
select ok((select seen_at is not null from public.level_ups where user_id = '00000000-0000-0000-0000-0000000000f1' and level = 2), 'backfilled levels are marked seen');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000000f1'), 0, 'and quiet: no Inbox rows');
select is(private.backfill_xp(), 0, 'running it again grants nothing');

select * from finish();
rollback;
