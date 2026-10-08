-- supabase/tests/database/deferred_queue.test.sql
-- The deferred-work queue (20261016100000): a session temp table that keeps the semantics of the old
-- transaction-local GUC strings. Levels once per person, badges at their earliest moment with that
-- moment's late flag, Perfect week judged once per person and week, late level-ups, rollback with a
-- subtransaction, empty after the sync.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select tests.create_user('00000000-0000-0000-0000-0000000001a1', 'q-ann@example.com', '{"full_name":"Ann"}');
select tests.create_user('00000000-0000-0000-0000-0000000001b1', 'q-bob@example.com', '{"full_name":"Bob"}');

create function pg_temp.queued(p_kind text) returns int language sql as $$
  select count(*)::int from private.queue_list(p_kind)
$$;

-- 1. Levels: each grant queues its person once; nothing is written until the sync.
select private.grant_xp('00000000-0000-0000-0000-0000000001a1', 30, 'check_in', 'check_in', 'q1', null, now(), false, false);
select private.grant_xp('00000000-0000-0000-0000-0000000001a1', 30, 'check_in', 'check_in', 'q2', null, now(), false, false);
select is(pg_temp.queued('level'), 1, 'two deferred grants to one person queue one level sync');
select is((select count(*)::int from public.level_ups where user_id = '00000000-0000-0000-0000-0000000001a1'), 0,
  'no level row before the sync');

-- 2. Badges: a later call with an earlier moment wins, with its own late flag; a later moment doesn't.
select private.award_badge('00000000-0000-0000-0000-0000000001a1', 'first_week', '2026-03-17 10:00+00', false, false, false);
select private.award_badge('00000000-0000-0000-0000-0000000001a1', 'first_week', '2026-03-08 10:00+00', false, false, true);
select private.award_badge('00000000-0000-0000-0000-0000000001a1', 'first_week', '2026-03-20 10:00+00', false, false, false);
select is((select row(count(*), min(at), bool_and(late))::text from private.queue_list('badge')),
  (select row(1, '2026-03-08 10:00+00'::timestamptz, true)::text), 'one queued badge, at its earliest moment, with that call''s late flag');

-- 3. A queued entry rolls back with its subtransaction (a failed review inside "Approve all").
savepoint s1;
select private.award_badge('00000000-0000-0000-0000-0000000001b1', 'first_step', now(), false, false, false);
select private.mark_late_levels(array['00000000-0000-0000-0000-0000000001b1'::uuid]);
rollback to savepoint s1;
select is((select count(*)::int from private.queue_list('badge') where user_id = '00000000-0000-0000-0000-0000000001b1')
          + pg_temp.queued('late'), 0, 'entries queued in a rolled-back subtransaction are gone');

-- 4. Perfect week: the first (person, week) queued stays.
select private.queue_add('week', '00000000-0000-0000-0000-0000000001b1', '2026-03-02', '2026-03-09 01:00+00', false, false);
select private.queue_add('week', '00000000-0000-0000-0000-0000000001b1', '2026-03-02', '2026-03-09 02:00+00', true, false);
select is((select row(count(*), min(at), bool_or(late))::text from private.queue_list('week')),
  (select row(1, '2026-03-09 01:00+00'::timestamptz, false)::text), 'a person''s week is queued once (the first entry)');

-- 5. A late level-up: the mark is read by the sync's level-up note, then cleared.
select private.mark_late_levels(array['00000000-0000-0000-0000-0000000001a1'::uuid, '00000000-0000-0000-0000-0000000001a1'::uuid, null]);
select is(pg_temp.queued('late'), 1, 'a person is marked late once');
select private.sync_deferred_levels();
select is((select max(level) from public.level_ups where user_id = '00000000-0000-0000-0000-0000000001a1'), 2,
  'the sync writes the level (60 XP: level 2)');
select is((select payload ->> 'late' from public.notifications where user_id = '00000000-0000-0000-0000-0000000001a1' and kind = 'level_up'),
  'true', 'its note is marked late');
select is((select unlocked_at from public.user_achievements where user_id = '00000000-0000-0000-0000-0000000001a1' and achievement_code = 'first_week'),
  '2026-03-08 10:00+00'::timestamptz, 'the badge is written at its earliest queued moment');
select is((select payload ->> 'late' from public.notifications where user_id = '00000000-0000-0000-0000-0000000001a1' and kind = 'badge_unlocked'),
  'true', 'with that moment''s late flag');
select is(pg_temp.queued('level') + pg_temp.queued('badge') + pg_temp.queued('week') + pg_temp.queued('late'), 0,
  'the sync empties the queue');

-- 6. An already earned badge isn't queued again.
select private.award_badge('00000000-0000-0000-0000-0000000001a1', 'first_week', '2026-01-01 10:00+00', false, false, false);
select is(pg_temp.queued('badge'), 0, 'an earned badge isn''t queued');

select * from finish();
rollback;
