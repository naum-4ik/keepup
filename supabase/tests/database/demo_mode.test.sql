begin;
create extension if not exists pgtap with schema extensions;
select plan(112);

select tests.create_anonymous_user('00000000-0000-0000-0000-0000000005a1');
select tests.create_user('00000000-0000-0000-0000-0000000005f1', 'demo-real@example.com', '{"full_name":"Real"}');
create temp table t (k text primary key, v uuid) on commit drop;
grant all on t to authenticated;

select ok((select is_demo from public.profiles where id = '00000000-0000-0000-0000-0000000005a1'), 'anonymous sign-in makes a demo profile');
select ok(not (select is_demo from public.profiles where id = '00000000-0000-0000-0000-0000000005f1'), 'a real sign-up is not demo');
select tests.authenticate_as('00000000-0000-0000-0000-0000000005a1');
select throws_ok($$update public.profiles set is_demo = false where id = auth.uid()$$, '42501', null, 'a demo user cannot clear the flag');
reset role;

insert into t select 'real', (private.create_group_impl('00000000-0000-0000-0000-0000000005f1', 'Real family', 'family')).id;
insert into t select 'demo', (private.create_group_impl('00000000-0000-0000-0000-0000000005a1', 'Family', 'family')).id;
select throws_ok($$select private.create_invite_impl('00000000-0000-0000-0000-0000000005a1', (select v from t where k='demo'), now())$$,
  '42501', 'keepup:demo', 'a demo user cannot create invites');
select throws_ok($$select private.accept_invite_impl('00000000-0000-0000-0000-0000000005a1',
  (private.create_invite_impl('00000000-0000-0000-0000-0000000005f1', (select v from t where k='real'), now())).token, now())$$,
  '42501', 'keepup:demo', 'a demo user cannot join a real group');
select throws_ok($$insert into public.group_members (group_id, user_id) values ((select v from t where k='demo'), '00000000-0000-0000-0000-0000000005f1')$$,
  '42501', 'keepup:demo', 'a real user cannot join a demo group');
select throws_ok($$select private.save_push_subscription_impl('00000000-0000-0000-0000-0000000005a1', 'https://fcm.googleapis.com/fcm/send/demo', 'k', 'a', 'ua')$$,
  '42501', 'keepup:demo', 'a demo user cannot add a push device');

-- Cleanup after 24 hours
select tests.create_anonymous_user('00000000-0000-0000-0000-0000000005a2');  -- fresh visitor
update public.profiles set created_at = now() - interval '25 hours' where id in ('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000005f1');
update auth.users set created_at = now() - interval '25 hours' where id in ('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000005f1');
update public.groups set created_at = now() - interval '25 hours' where id = (select v from t where k='real');
insert into public.profiles (id, display_name, is_demo, created_at) values ('00000000-0000-0000-0000-0000000005b1', 'Alex', true, now() - interval '25 hours');
-- Sign-in history (auth.audit_log_entries) of the old demo login, the fresh one and the old real user.
insert into auth.audit_log_entries (instance_id, id, payload, created_at, ip_address)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
       json_build_object('action', 'login', 'actor_id', u, 'actor_username', '', 'traits', json_build_object('provider', 'anonymous')),
       now() - interval '25 hours', '203.0.113.7'
  from unnest(array['00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000005a2', '00000000-0000-0000-0000-0000000005f1']) u;
select is(private.cleanup_demo(now()), 2, 'old visitor and old bot removed');
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-0000000005a1'), 0, 'old demo login deleted');
select is((select count(*)::int from public.groups where id = (select v from t where k='demo')), 0, 'its group deleted');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000005a2'), 1, 'a visitor under 24h stays');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000005f1'), 1, 'an old real user stays');
select is((select count(*)::int from public.groups where id = (select v from t where k='real')), 1, 'an old real group stays');
select is((select count(*)::int from auth.audit_log_entries where payload->>'actor_id' = '00000000-0000-0000-0000-0000000005a1'), 0, 'the old demo login''s sign-in history deleted');
select is((select count(*)::int from auth.audit_log_entries where payload->>'actor_id' = '00000000-0000-0000-0000-0000000005a2'), 1, 'a fresh visitor''s sign-in history stays');
select is((select count(*)::int from auth.audit_log_entries where payload->>'actor_id' = '00000000-0000-0000-0000-0000000005f1'), 1, 'an old real user''s sign-in history stays');
select ok(exists (select 1 from cron.job where jobname = 'keepup-demo-cleanup'), 'cleanup is scheduled');
-- A converted login keeps is_demo but is real now: cleanup must not delete it.
select tests.create_anonymous_user('00000000-0000-0000-0000-0000000005a3');
insert into t select 'conv', (private.create_group_impl('00000000-0000-0000-0000-0000000005a3', 'Converted family', 'family')).id;
update public.groups set created_at = now() - interval '25 hours' where id = (select v from t where k='conv');
-- The old bot is an active member of the converted user's group: the group must still survive.
insert into public.profiles (id, display_name, is_demo, created_at) values ('00000000-0000-0000-0000-0000000005b3', 'Alex', true, now() - interval '25 hours');
insert into public.group_members (group_id, user_id) values ((select v from t where k='conv'), '00000000-0000-0000-0000-0000000005b3');
-- A demo group whose creator is gone (created_by null) with only an old bot left in it.
insert into public.profiles (id, display_name, is_demo, created_at) values ('00000000-0000-0000-0000-0000000005b2', 'Alex', true, now() - interval '25 hours');
with g as (insert into public.groups (name, kind, timezone, week_start, created_by) values ('Orphan', 'family', 'UTC', 1, null) returning id)
insert into t select 'orphan', id from g;
insert into public.group_members (group_id, user_id) values ((select v from t where k='orphan'), '00000000-0000-0000-0000-0000000005b2');
update auth.users set is_anonymous = false, email = 'converted@example.com', created_at = now() - interval '25 hours' where id = '00000000-0000-0000-0000-0000000005a3';
update public.profiles set created_at = now() - interval '25 hours' where id = '00000000-0000-0000-0000-0000000005a3';
select private.cleanup_demo(now());
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000005a3'), 1, 'a converted login is never cleaned up');
select is((select count(*)::int from public.groups where id = (select v from t where k='conv')), 1, 'a converted login''s group is never cleaned up');
select is((select count(*)::int from public.groups where id = (select v from t where k='orphan')), 0, 'a demo group with no creator goes with its old bot');

-- start_demo: Sam's 30 days
select tests.create_anonymous_user('00000000-0000-0000-0000-0000000005c1');
select tests.authenticate_as('00000000-0000-0000-0000-0000000005f1');
select throws_ok($$select public.start_demo('Europe/Berlin')$$, '42501', 'keepup:not_demo', 'a real user cannot seed');
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000005c1');
select lives_ok($$select public.start_demo('Europe/Berlin')$$, 'the visitor seeds (real call path: replica role inside security definer)');
reset role;
\set sam '''00000000-0000-0000-0000-0000000005c1'''
select is((select display_name from public.profiles where id = :sam), 'Sam', 'you are Sam');
select ok((select onboarded_at is not null from public.profiles where id = :sam), 'onboarded');
select is((select count(*)::int from public.habits where owner_id = :sam and group_id is null), 4, '4 private habits');
select is((select current_streak from private.habit_streaks((select id from public.habits where owner_id = :sam and title = 'Read'), now())), 12, 'Read streak 12');
select ok(exists (select 1 from public.habit_freezes f join public.habits h on h.id = f.habit_id where h.owner_id = :sam), 'a paused week');
select is((select count(*)::int from public.group_members m join public.groups g on g.id = m.group_id where g.created_by = :sam and m.left_at is null), 2, 'Sam and Alex in Family');
select is((select display_name from public.profiles where kind = 'child' and group_id = (select id from public.groups where created_by = :sam)), 'Nova', 'Nova');
select is((select count(*)::int from public.check_ins c join public.habits h on h.id = c.habit_id
            where h.group_id = (select id from public.groups where created_by = :sam) and c.status = 'pending'), 1, 'one check-in waiting');
select is((select target::int from public.treat_goals where received_at is null and child_id = (select id from public.profiles where display_name = 'Nova' and kind = 'child' and group_id = (select id from public.groups where created_by = :sam))), 20, 'treat goal 20 stars');
select is((select (private.child_rewards_impl(:sam, c.id, now())->'goal'->>'stars')::int from public.profiles c
            where c.kind = 'child' and c.group_id = (select id from public.groups where created_by = :sam)), 0, 'treat goal at 0 of 20');
select is(private.level_for((select sum(amount) from public.xp_events where user_id = :sam)), 4, 'level 4');
select ok((select count(*) from public.level_ups where user_id = :sam and seen_at is null) = 0, 'no level moment waiting');
select ok((select count(*) from public.user_achievements where user_id = :sam) >= 3, 'a few badges');
select ok((select count(*) from public.user_achievements where user_id = :sam and seen_at is null) = 0, 'no badge moment waiting');
-- The seeded results follow the real rules (finalize's settled_outcome, rest days included).
create temp table seeded as select h.id from public.habits h
  where h.owner_id = :sam or h.group_id = (select id from public.groups where created_by = :sam)
     or h.owner_id = (select id from public.profiles where kind = 'child' and group_id = (select id from public.groups where created_by = :sam));
select is((select count(*)::int from seeded), 9, '9 seeded habits');
select is((select count(*)::int from public.period_results x join public.habits h on h.id = x.habit_id
            where h.id in (select id from seeded) and x.outcome <> private.settled_outcome(h, x.period_start)), 0,
          'every seeded result matches the real rule');
select is((select current_streak from private.habit_streaks((select id from public.habits where title = 'Family dinner'
            and group_id = (select id from public.groups where created_by = :sam)), now())), 5, 'Family dinner streak 5');
select ok(exists (select 1 from public.period_results x join public.habits h on h.id = x.habit_id
                   where h.title = 'Walk together' and h.id in (select id from seeded) and x.outcome = 'missed'), 'Walk together missed a week');
select is((select count(*)::int from public.check_ins c where c.user_id = (select id from public.profiles where display_name = 'Nova' and kind = 'child'
            and group_id = (select id from public.groups where created_by = :sam)) and c.created_at > now()), 0, 'no check-in in the future');
select is((select count(*)::int from public.notifications where user_id = :sam), 1, 'one Inbox row: the approval request');
select is((select count(*)::int from public.profiles where display_name = 'Alex' and is_demo
            and id in (select user_id from public.group_members where group_id = (select id from public.groups where created_by = :sam))), 1, 'Alex is a demo profile');
-- Nothing left for the cron.
create temp table before_results as select count(*) n from public.period_results where habit_id in (select id from seeded);
select private.finalize_periods(now());
select is((select count(*) from public.period_results where habit_id in (select id from seeded)), (select n from before_results),
          'finalize adds no result for seeded habits');
-- Idempotent.
select tests.authenticate_as('00000000-0000-0000-0000-0000000005c1');
select public.start_demo('Europe/Berlin');
reset role;
select is((select count(*)::int from public.habits where owner_id = :sam and group_id is null), 4, 'a second tap seeds nothing more');
-- First real tap: XP as expected, no surprise badges or level-ups.
create temp table ach_before as select count(*) n from public.user_achievements where user_id = :sam;
select tests.authenticate_as('00000000-0000-0000-0000-0000000005c1');
select public.check_in((select id from public.habits where owner_id = :sam and title = 'Read'));
reset role;
select is((select amount from public.xp_events where user_id = :sam and reason = 'check_in' order by created_at desc limit 1), 22, 'day-13 check-in earns 10 + 12');
select is((select count(*) from public.user_achievements where user_id = :sam), (select n from ach_before), 'no surprise badge');
select is(private.level_for((select sum(amount) from public.xp_events where user_id = :sam)), 4, 'still level 4');
-- Progress → Recaps: the seeded 30 days give weekly recaps (the account itself is minutes old).
select tests.authenticate_as('00000000-0000-0000-0000-0000000005c1');
select ok((select count(*) from public.recaps('week')) >= 4 and (select count(*) from public.recaps('week') r where (r->>'done')::int > 0) >= 1,
          'Recaps: the seeded weeks (4+) with a win');
reset role;
-- The seeded history is old, the visitor is not: cleanup keeps using the real sign-up time.
select private.cleanup_demo(now());
select is((select count(*)::int from public.profiles where id = :sam), 1, 'a freshly seeded demo survives cleanup');
update public.profiles set created_at = now() - interval '25 hours' where id = :sam;
update auth.users set created_at = now() - interval '25 hours' where id = :sam;
select private.cleanup_demo(now());
select is((select count(*)::int from public.profiles where id = :sam), 0, 'a seeded demo older than 24h is removed');


-- Date-proof: the same seed at fixed future moments in Europe/Berlin (a Monday and a Sunday, just after
-- midnight and just before it). Dates are computed from the real clock, as habits can't start in the past.
-- Each run is a fresh visitor, checked at its own p_now.
create function pg_temp.demo_at(p_user uuid, p_now timestamptz, p_label text) returns setof text language plpgsql as $$
declare
  v_group uuid; v_nova uuid; v_today date; v_week date; v_before bigint; v_goal jsonb; v_rewards jsonb;
begin
  perform private.start_demo_impl(p_user, 'Europe/Berlin', p_now);
  v_group := (select id from public.groups where created_by = p_user);
  v_nova := (select id from public.profiles where kind = 'child' and group_id = v_group);
  v_today := (p_now at time zone 'Europe/Berlin')::date;
  v_week := private.period_start('week', v_today, 1::smallint);
  create temp table run_seeded on commit drop as select h.id from public.habits h
   where h.owner_id in (p_user, v_nova) or h.group_id = v_group;
  return next is((select count(*)::int from run_seeded), 9, p_label || ': 9 seeded habits');
  return next is((select current_streak from private.habit_streaks((select id from public.habits where owner_id = p_user and title = 'Read'), p_now)),
                 12, p_label || ': Read streak 12');
  return next is((select current_streak from private.habit_streaks((select id from public.habits where group_id = v_group and title = 'Family dinner'), p_now)),
                 5, p_label || ': Family dinner streak 5');
  return next is(private.level_for((select sum(amount) from public.xp_events where user_id = p_user)), 4, p_label || ': level 4');
  return next is((select count(*)::int from public.level_ups where user_id = p_user and seen_at is null), 0, p_label || ': no level moment waiting');
  return next is((select count(*)::int from public.user_achievements where user_id = p_user and seen_at is null), 0, p_label || ': no badge moment waiting');
  return next is((select count(*)::int from public.period_results x join public.habits h on h.id = x.habit_id
                   where h.id in (select id from run_seeded) and x.outcome <> private.settled_outcome(h, x.period_start)), 0,
                 p_label || ': every seeded result matches the real rule');
  v_rewards := private.child_rewards_impl(p_user, v_nova, p_now);
  return next is((v_rewards->>'week_start')::date, v_week, p_label || ': Nova''s week starts on Monday');
  return next is((v_rewards->>'stars_this_week')::int, least(7, 4 * (v_today - v_week + 1)), p_label || ': Nova''s stars this week (4 a day, at most 7)');
  -- The goal starts at 0: no seeded star is at or after the seed moment (the goal is created then).
  return next is((v_rewards->'goal'->>'target')::int || ' ' || coalesce(v_rewards->'goal'->>'reached_at', 'open'), '20 open', p_label || ': treat goal of 20, not reached');
  return next is((select count(*)::int from public.check_ins c where c.user_id = v_nova and c.created_at >= p_now), 0,
                 p_label || ': no star at or after the seed moment');
  return next is((v_rewards->'goal'->>'stars')::int, 0, p_label || ': treat goal at 0 of 20');
  return next is((select c.created_at from public.check_ins c join public.habits h on h.id = c.habit_id
                   where h.group_id = v_group and c.status = 'pending'), p_now, p_label || ': the waiting check-in is from the seed moment');
  return next ok((select count(*) from private.recaps_impl(p_user, 'week', 8, p_now)) >= 4
                 and (select count(*) from private.recaps_impl(p_user, 'week', 8, p_now) r where (r->>'done')::int > 0) >= 1,
                 p_label || ': the seeded weeks (4+) in Recaps, with a win');
  v_before := (select count(*) from public.period_results where habit_id in (select id from run_seeded));
  perform private.finalize_periods(p_now);
  return next is((select count(*) from public.period_results where habit_id in (select id from run_seeded)), v_before,
                 p_label || ': finalize adds no result for seeded habits');
  drop table run_seeded;
end; $$;
create temp table berlin as
  select date_trunc('week', now() at time zone 'Europe/Berlin')::date + 7 as mon,
         date_trunc('week', now() at time zone 'Europe/Berlin')::date + 13 as sun;
select tests.create_anonymous_user('00000000-0000-0000-0000-0000000005d1');
select tests.create_anonymous_user('00000000-0000-0000-0000-0000000005d2');
select tests.create_anonymous_user('00000000-0000-0000-0000-0000000005d3');
select tests.create_anonymous_user('00000000-0000-0000-0000-0000000005d4');
select is(extract(isodow from mon)::int || ' ' || extract(isodow from sun)::int, '1 7', 'setup: a Monday and a Sunday') from berlin;
select pg_temp.demo_at('00000000-0000-0000-0000-0000000005d1', (mon + time '00:30') at time zone 'Europe/Berlin', 'Monday 00:30') from berlin;
select pg_temp.demo_at('00000000-0000-0000-0000-0000000005d2', (mon + time '23:59') at time zone 'Europe/Berlin', 'Monday 23:59') from berlin;
select pg_temp.demo_at('00000000-0000-0000-0000-0000000005d3', (sun + time '00:30') at time zone 'Europe/Berlin', 'Sunday 00:30') from berlin;
select pg_temp.demo_at('00000000-0000-0000-0000-0000000005d4', (sun + time '23:59') at time zone 'Europe/Berlin', 'Sunday 23:59') from berlin;

select * from finish();
rollback;
