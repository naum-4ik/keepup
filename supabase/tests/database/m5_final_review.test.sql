-- supabase/tests/database/m5_final_review.test.sql
-- M5 final review fixes: streak badges judged at the end of a late upgrade's walk forward (I1), the
-- recap's longest streak on a group habit is the person's own part (M5), check_in_with takes the
-- children in id order (M7), and habit_streaks reads an unsettled day the way finalize will settle it
-- (M4). Every time is pinned, except check_in_with, which uses now() (its fixture is built from now()).
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

-- finalize_periods scans every habit; start from none (rolled back at the end).
delete from public.habits;

select tests.create_user(id::uuid, n || '@example.com', jsonb_build_object('full_name', n))
  from (values ('00000000-0000-0000-0000-0000000000a1', 'Anna'), ('00000000-0000-0000-0000-0000000000b1', 'Ben'),
               ('00000000-0000-0000-0000-0000000000f1', 'Fay'), ('00000000-0000-0000-0000-0000000000c1', 'Cleo'),
               ('00000000-0000-0000-0000-0000000000c2', 'Cal'), ('00000000-0000-0000-0000-0000000000e1', 'Gil'),
               ('00000000-0000-0000-0000-0000000000e2', 'Pia')) v(id, n);
update public.profiles set timezone = 'UTC', week_start = 1
 where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1',
              '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000e1',
              '00000000-0000-0000-0000-0000000000e2');

create temp table t (k text primary key, v uuid) on commit drop;
create function pg_temp.family(p_key text, p_owner uuid, p_member uuid) returns void language plpgsql as $$
declare
  v_inv uuid;
begin
  insert into t select p_key, (private.create_group_impl(p_owner, p_key, 'family')).id;
  v_inv := (private.create_invite_impl(p_owner, (select v from t where k = p_key), '2026-09-01 08:00Z')).id;
  perform private.accept_invite_impl(p_member, (select token from public.group_invites where id = v_inv), '2026-09-01 08:00Z');
  update public.group_members set joined_at = '2026-09-01' where group_id = (select v from t where k = p_key);
end;
$$;
create function pg_temp.has(p_user uuid, p_code text) returns boolean language sql as $$
  select exists (select 1 from public.user_achievements a where a.user_id = p_user and a.achievement_code = p_code);
$$;
select pg_temp.family('fam', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1');
select pg_temp.family('crew', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2');

-- d1 Walk (the family, daily, Anna and Ben), d2 Read (Fay, private, from the 12th), d3 Swim (Cleo and
-- Cal's crew, daily), d4 Stretch (Gil, 7 days), d5 Yoga (Gil, 3 days).
set local session_replication_role = replica;
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, requires_approval, created_at, created_by)
select x.id::uuid, x.owner::uuid, x.grp, x.title, null, '⭐', 1, 'day', x.starts::date, 1, false, (x.starts || ' 08:00Z')::timestamptz, x.creator::uuid
  from (values
    ('00000000-0000-0000-0000-0000000000d1', null, (select v from t where k = 'fam'), 'Walk', '2026-10-12', '00000000-0000-0000-0000-0000000000a1'),
    ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000f1', null::uuid, 'Read', '2026-10-12', '00000000-0000-0000-0000-0000000000f1'),
    ('00000000-0000-0000-0000-0000000000d3', null, (select v from t where k = 'crew'), 'Swim', '2026-11-02', '00000000-0000-0000-0000-0000000000c1'),
    ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000e1', null, 'Stretch', '2026-12-01', '00000000-0000-0000-0000-0000000000e1'),
    ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000e1', null, 'Yoga', '2026-12-05', '00000000-0000-0000-0000-0000000000e1')
  ) x(id, owner, grp, title, starts, creator);
set local session_replication_role = origin;

-- I1. Walk: both do 12–16 Oct, Anna alone on the 17th, both on 18–19; Read: Fay 12–16 and 18–19.
select private.check_in_impl('00000000-0000-0000-0000-0000000000d1', u, d + interval '9 hours')
  from generate_series('2026-10-12'::timestamp, '2026-10-19', '1 day') d
 cross join unnest(array['00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1']::uuid[]) u
 where not (u = '00000000-0000-0000-0000-0000000000b1' and d::date = '2026-10-17');
select private.check_in_impl('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000f1', d + interval '9 hours')
  from generate_series('2026-10-12'::timestamp, '2026-10-19', '1 day') d where d::date <> '2026-10-17';
select private.finalize_periods('2026-10-20 01:00Z');
create temp view ms7 as
  select x.user_id, x.source_id from public.xp_events x
   where x.reason = 'milestone' and split_part(x.source_id, ':', 3) = '7'
     and x.habit_id in ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2');

select is(array(select outcome from public.period_results where habit_id in ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2')
                  and period_start = '2026-10-17' order by habit_id), array['missed', 'missed'],
  'the 17th settles missed (Ben''s part on Walk; Fay has no rest day saved after 5 days)');
select is(array[pg_temp.has('00000000-0000-0000-0000-0000000000a1', 'first_week'), pg_temp.has('00000000-0000-0000-0000-0000000000b1', 'first_week'),
                pg_temp.has('00000000-0000-0000-0000-0000000000f1', 'first_week')], array[true, false, false],
  'before the late taps: Anna has First week by her own run (12–18), Ben and Fay don''t');

-- Ben's tap for the 17th (offline) and Fay's arrive on the 20th: the 17th becomes done, 12–19 is 8 in a row.
select private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', '2026-10-20 09:00Z',
  null, false, 'c0000000-0000-0000-0000-0000000000b1', '2026-10-17 21:00Z');
select private.check_in_impl('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000f1', '2026-10-20 09:00Z',
  null, false, 'c0000000-0000-0000-0000-0000000000f1', '2026-10-17 21:00Z');
select is((select outcome from public.period_results where habit_id = '00000000-0000-0000-0000-0000000000d1' and period_start = '2026-10-17'), 'done',
  'the late tap upgrades the group''s 17th');
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000a1', 'first_week') and pg_temp.has('00000000-0000-0000-0000-0000000000b1', 'first_week'),
  'group: Ben gets First week too, by his own run judged at the walk''s last done day (the 19th)');
select is((select array_agg(user_id || '@' || source_id order by user_id) from ms7 where source_id like '00000000-0000-0000-0000-0000000000d1:%'),
  array['00000000-0000-0000-0000-0000000000a1@00000000-0000-0000-0000-0000000000d1:2026-10-12:7',
        '00000000-0000-0000-0000-0000000000b1@00000000-0000-0000-0000-0000000000d1:2026-10-12:7'],
  'group: and the 7-day milestone once each, keyed to the streak''s first day');
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000f1', 'first_week'), 'private: First week at the walk''s end too');
select is((select array_agg(source_id) from ms7 where user_id = '00000000-0000-0000-0000-0000000000f1'),
  array['00000000-0000-0000-0000-0000000000d2:2026-10-12:7'], 'private: the 7-day milestone once');
select is((select (payload ->> 'late')::boolean from public.notifications
            where user_id = '00000000-0000-0000-0000-0000000000f1' and kind = 'badge_unlocked' and payload ->> 'code' = 'first_week'), true,
  'the badge is marked late (it arrived with a late tap)');

-- M5. Swim, week of Mon 2 Nov: Cleo every day, Cal not on Wednesday, so the crew's Wednesday is missed.
select private.check_in_impl('00000000-0000-0000-0000-0000000000d3', u, d + interval '9 hours')
  from generate_series('2026-11-02'::timestamp, '2026-11-08', '1 day') d
 cross join unnest(array['00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2']::uuid[]) u
 where not (u = '00000000-0000-0000-0000-0000000000c2' and d::date = '2026-11-04');
select private.finalize_periods('2026-11-09 01:00Z');
select is((select (s.current_streak) from private.habit_streaks('00000000-0000-0000-0000-0000000000d3', '2026-11-09 10:00Z') s), 4,
  'the crew''s own streak restarted after Wednesday (4)');
select is(private.recap_impl('00000000-0000-0000-0000-0000000000c1', 'week', '2026-11-02', '2026-11-09 10:00Z') -> 'longest' ->> 'length', '7',
  'recap: Cleo''s longest streak is her own part (7), not the group''s');
select is(private.recap_impl('00000000-0000-0000-0000-0000000000c2', 'week', '2026-11-02', '2026-11-09 10:00Z') -> 'longest' ->> 'length', '4',
  'recap: Cal''s is his (4, after his Wednesday)');

-- M4. Stretch: 1–7 Dec done, settled; the 8th not done and not settled yet (finalize hasn't run).
-- Yoga: 5–7 Dec done, no rest day saved.
select private.check_in_impl('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000e1', d + interval '9 hours')
  from generate_series('2026-12-01'::timestamp, '2026-12-07', '1 day') d;
select private.check_in_impl('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000e1', d + interval '9 hours')
  from generate_series('2026-12-05'::timestamp, '2026-12-07', '1 day') d;
select private.finalize_periods('2026-12-08 01:00Z');
select is((select s.current_streak from private.habit_streaks('00000000-0000-0000-0000-0000000000d4', '2026-12-09 00:05Z') s), 7,
  'an unsettled day a saved rest day will cover keeps the streak before finalize runs');
select is((select s.current_streak from private.habit_streaks('00000000-0000-0000-0000-0000000000d5', '2026-12-09 00:05Z') s), 0,
  'with no rest day saved, it ends it, as finalize will');
select private.finalize_periods('2026-12-09 01:00Z');
select is((select s.current_streak from private.habit_streaks('00000000-0000-0000-0000-0000000000d4', '2026-12-09 01:05Z') s)
          || ':' || (select outcome from public.period_results where habit_id = '00000000-0000-0000-0000-0000000000d4' and period_start = '2026-12-08'),
  '7:rested',
  'and the same after finalize settles it rested');

-- Owner 2026-10-06: late personal notes never push. Lia (Achievements on Sound) is 15 XP short of
-- level 2 until her late tap for 5 Jan upgrades it; Max crosses it with an on-time check-in.
select tests.create_user(id::uuid, n || '@example.com', jsonb_build_object('full_name', n))
  from (values ('00000000-0000-0000-0000-0000000000a2', 'Lia'), ('00000000-0000-0000-0000-0000000000a3', 'Max'),
               ('00000000-0000-0000-0000-0000000000a4', 'Oli')) v(id, n);
update public.profiles set timezone = 'UTC', week_start = 1
 where id in ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a4');
select private.set_notification_delivery_impl(u, 'achievements', 'sound')
  from unnest(array['00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3']::uuid[]) u;
select is(array(select private.push_allowed('00000000-0000-0000-0000-0000000000a2', k, null, null, x.p::jsonb, '2027-01-01 12:00Z')
                  from unnest(array['streak_milestone', 'badge_unlocked', 'level_up']) k cross join (values ('{"late": true}'), ('{}')) x(p)),
  array[false, true, false, true, false, true], 'late milestone, badge and level-up notes stay in the Inbox; on time they push');
set local session_replication_role = replica;
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, requires_approval, created_at, created_by)
select x.id::uuid, x.owner::uuid, null, x.title, null, '⭐', x.target, 'day', x.starts::date, 1, false, (x.starts || ' 08:00Z')::timestamptz, x.owner::uuid
  from (values ('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000a2', 'Draw', '2027-01-04', 1),
               ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000a3', 'Draw', '2027-01-04', 1),
               ('00000000-0000-0000-0000-0000000000da', '00000000-0000-0000-0000-0000000000a4', 'Water', '2027-02-01', 8)) x(id, owner, title, starts, target);
insert into public.xp_events (user_id, amount, reason, source_type, source_id) values ('00000000-0000-0000-0000-0000000000a3', 45, 'check_in', 'check_in', 'raw-a3');
-- Oli: 1–20 Feb done (a 20-day streak going into the 21st).
insert into public.period_results (habit_id, period_start, outcome, finalized_at)
select '00000000-0000-0000-0000-0000000000da', d::date, 'done', d + interval '1 day 1 hour' from generate_series('2027-02-01'::timestamp, '2027-02-20', '1 day') d;
set local session_replication_role = origin;
select private.check_in_impl('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000a2', '2027-01-04 09:00Z');
select private.check_in_impl('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000a3', '2027-01-04 09:00Z');
select private.finalize_periods('2027-01-06 01:00Z');
select is((select coalesce(sum(amount), 0)::int from public.xp_events where user_id = '00000000-0000-0000-0000-0000000000a2'), 35,
  'Lia: 35 XP before the late tap (10 + 20 + day 1''s 5), still level 1');
select private.check_in_impl('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000a2', '2027-01-06 09:00Z',
  null, false, 'c0000000-0000-0000-0000-0000000000a2', '2027-01-05 20:00Z');
select is((select (payload ->> 'late') || ':' || push::text from public.notifications
            where user_id = '00000000-0000-0000-0000-0000000000a2' and kind = 'level_up'), 'true:false',
  'a level-up from a late tap is marked late and doesn''t push, even on Sound');
select is((select bool_and((payload ->> 'late')::boolean and not push) from public.notifications
            where user_id = '00000000-0000-0000-0000-0000000000a2' and kind = 'streak_milestone' and payload ->> 'streak' = '2'), true,
  'the late 2-day milestone stays in the Inbox too');
select is((select coalesce(payload ->> 'late', 'none') || ':' || push::text from public.notifications
            where user_id = '00000000-0000-0000-0000-0000000000a3' and kind = 'level_up'), 'none:true',
  'an on-time level-up isn''t late and pushes');

-- Owner 2026-10-06: the streak bonus once per habit per period. Oli: 8 glasses on 21 Feb, on a 20-day streak.
insert into t select 'w' || i, (private.check_in_impl('00000000-0000-0000-0000-0000000000da', '00000000-0000-0000-0000-0000000000a4',
  '2027-02-21 09:00Z'::timestamptz + make_interval(mins => i))).id from generate_series(1, 8) i;
create temp view oli as
  select x.source_id::uuid as check_in, x.reason, x.amount from public.xp_events x
   where x.user_id = '00000000-0000-0000-0000-0000000000a4' and x.source_type = 'check_in';
select is(array(select (select amount from oli where check_in = (select v from t where k = 'w' || i) and reason = 'check_in') from generate_series(1, 8) i),
  array[30, 10, 10, 10, 10, 10, 10, 10], 'the first check-in of the day earns the streak bonus, the others the base 10');
select is((select sum(amount)::int from oli where reason = 'check_in'), 100, '8 a day on a 20-day streak: 30 + 7 × 10 = 100');
select private.undo_check_in_impl((select v from t where k = 'w1'), '00000000-0000-0000-0000-0000000000a4', '2027-02-21 10:00Z');
select is((select amount from oli where check_in = (select v from t where k = 'w1') and reason = 'check_in_undone'), -30,
  'undoing the first takes back exactly its 30');
select is((select sum(amount)::int from oli), 70, 'and the others keep theirs (no re-grant)');
insert into t select 'w9', (private.check_in_impl('00000000-0000-0000-0000-0000000000da', '00000000-0000-0000-0000-0000000000a4', '2027-02-21 10:05Z')).id;
select is((select amount from oli where check_in = (select v from t where k = 'w9') and reason = 'check_in'), 10,
  'a new one while the others stand earns the base 10');

-- Controller ruling: a group habit's streak badges read each member's own streak.
select tests.create_user(id::uuid, n || '@example.com', jsonb_build_object('full_name', n))
  from (values ('00000000-0000-0000-0000-0000000000b2', 'Kai'), ('00000000-0000-0000-0000-0000000000b3', 'Jo'),
               ('00000000-0000-0000-0000-0000000000b4', 'Pat'), ('00000000-0000-0000-0000-0000000000b5', 'Quin'),
               ('00000000-0000-0000-0000-0000000000a5', 'Ros'), ('00000000-0000-0000-0000-0000000000a6', 'Sam')) v(id, n);
update public.profiles set timezone = 'UTC', week_start = 1
 where id in ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000b4',
              '00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a6');
select pg_temp.family('join', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b3');
update public.group_members set joined_at = '2027-04-06 00:00Z'
 where group_id = (select v from t where k = 'join') and user_id = '00000000-0000-0000-0000-0000000000b3';
select pg_temp.family('miss', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000b5');
select pg_temp.family('kids', '00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a6');
insert into t select 'kid', private.create_child_impl('00000000-0000-0000-0000-0000000000a5', (select v from t where k = 'kids'), 'Bo', '🐼', 'peach', true);
set local session_replication_role = replica;
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, requires_approval, created_at, created_by)
select x.id::uuid, x.owner, x.grp, x.title, null, '⭐', x.target, 'day', x.starts::date, 1, false, (x.starts || ' 08:00Z')::timestamptz, x.creator::uuid
  from (values
    ('00000000-0000-0000-0000-0000000000db', null::uuid, (select v from t where k = 'join'), 'Run', '2027-04-01', 1, '00000000-0000-0000-0000-0000000000b2'),
    ('00000000-0000-0000-0000-0000000000dc', null, (select v from t where k = 'miss'), 'Run', '2027-05-01', 1, '00000000-0000-0000-0000-0000000000b4'),
    ('00000000-0000-0000-0000-0000000000dd', (select v from t where k = 'kid'), null, 'Teeth', '2027-06-01', 2, '00000000-0000-0000-0000-0000000000a5')
  ) x(id, owner, grp, title, starts, target, creator);
-- Bo: 1–5 Jun done.
insert into public.period_results (habit_id, period_start, outcome, finalized_at)
select '00000000-0000-0000-0000-0000000000dd', d::date, 'done', d + interval '1 day 1 hour' from generate_series('2027-06-01'::timestamp, '2027-06-05', '1 day') d;
set local session_replication_role = origin;
-- Run (join): Kai 1–7 Apr, Jo joined on the 6th and did 6–7. Run (miss): Pat 1–7 May, Quin 1–6.
select private.check_in_impl('00000000-0000-0000-0000-0000000000db', u, d + interval '9 hours')
  from generate_series('2027-04-01'::timestamp, '2027-04-07', '1 day') d
 cross join unnest(array['00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b3']::uuid[]) u
 where u = '00000000-0000-0000-0000-0000000000b2' or d::date >= '2027-04-06';
select private.finalize_periods('2027-04-08 01:00Z');
select is((select array_agg(outcome order by period_start) from public.period_results where habit_id = '00000000-0000-0000-0000-0000000000db'),
  array['done', 'done', 'done', 'done', 'done', 'done', 'done'], 'the group''s run is 7 days');
select is(array[pg_temp.has('00000000-0000-0000-0000-0000000000b2', 'first_week'), pg_temp.has('00000000-0000-0000-0000-0000000000b3', 'first_week')],
  array[true, false], 'First week for Kai (7 of his own), not for Jo, who joined on day 6 (2 of hers)');
select private.check_in_impl('00000000-0000-0000-0000-0000000000dc', u, d + interval '9 hours')
  from generate_series('2027-05-01'::timestamp, '2027-05-07', '1 day') d
 cross join unnest(array['00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000b5']::uuid[]) u
 where u = '00000000-0000-0000-0000-0000000000b4' or d::date <= '2027-05-06';
select private.finalize_periods('2027-05-08 01:00Z');
select is((select outcome from public.period_results where habit_id = '00000000-0000-0000-0000-0000000000dc' and period_start = '2027-05-07'), 'missed',
  'Quin''s miss settles the group''s 7th missed');
select is(array[pg_temp.has('00000000-0000-0000-0000-0000000000b4', 'first_week'), pg_temp.has('00000000-0000-0000-0000-0000000000b5', 'first_week')],
  array[true, false], 'Pat did all 7 and gets First week anyway; Quin (6) doesn''t');

-- The streak bonus once per period, the reviewer's cases: a parent's two taps for a child on a 5-day streak.
insert into t select 'bo' || i, (private.check_in_impl('00000000-0000-0000-0000-0000000000dd', '00000000-0000-0000-0000-0000000000a5',
  '2027-06-06 09:00Z'::timestamptz + make_interval(mins => i), (select v from t where k = 'kid'))).id from generate_series(1, 2) i;
select is(array(select (select x.amount from public.xp_events x where x.reason = 'check_in' and x.source_id = (select v::text from t where k = 'bo' || i))
                  from generate_series(1, 2) i), array[15, 10], 'a child on a 5-day streak, two taps by a parent: 15, then 10');

-- M7. check_in_with takes the children in id order, whatever order the app sends (two parents can't
-- lock the same children in opposite orders). Built from now(): it checks in at now().
select pg_temp.family('home', '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000f1');
insert into t select 'kid' || i, private.create_child_impl('00000000-0000-0000-0000-0000000000e2', (select v from t where k = 'home'), 'Kid ' || i, '🐼', 'peach', true)
  from generate_series(1, 2) i;
set local session_replication_role = replica;
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, requires_approval, created_at, created_by)
select x.id::uuid, null, (select v from t where k = 'home'), x.title, null, '⭐', 1, 'day', (now() - interval '2 days')::date, 1, false,
       now() - interval '2 days', '00000000-0000-0000-0000-0000000000e2'
  from (values ('00000000-0000-0000-0000-0000000000d6', 'Tidy'), ('00000000-0000-0000-0000-0000000000d7', 'Teeth')) x(id, title);
insert into public.group_habit_participants (habit_id, profile_id)
select h::uuid, k.v from unnest(array['00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000d7']) h
 cross join (select v from t where k in ('kid1', 'kid2')) k;
set local session_replication_role = origin;
create temp table w (habit uuid, users uuid[]) on commit drop;
grant select on t to authenticated;
grant insert on w to authenticated;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000e2');
insert into w select '00000000-0000-0000-0000-0000000000d6', array(select c.user_id from public.check_in_with('00000000-0000-0000-0000-0000000000d6',
  array[(select v from t where k = 'kid1'), (select v from t where k = 'kid2')]) c);
insert into w select '00000000-0000-0000-0000-0000000000d7', array(select c.user_id from public.check_in_with('00000000-0000-0000-0000-0000000000d7',
  array[(select v from t where k = 'kid2'), (select v from t where k = 'kid1')]) c);
reset role;
select is((select users from w where habit = '00000000-0000-0000-0000-0000000000d7'), (select users from w where habit = '00000000-0000-0000-0000-0000000000d6'),
  'check_in_with: the same result whatever the children''s order');
select is((select users from w where habit = '00000000-0000-0000-0000-0000000000d7'),
  array['00000000-0000-0000-0000-0000000000e2'::uuid] || array(select v from t where k in ('kid1', 'kid2') order by v),
  'the adult first, then the children in id order');

-- "Approve all" with two pending taps in one period (Ros, approval habit, a 5-day own streak): 15, then
-- 10. Built from today (UTC): review_check_ins approves at now(), inside the period's review window.
set local session_replication_role = replica;
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, requires_approval, created_at, created_by)
values ('00000000-0000-0000-0000-0000000000de', null, (select v from t where k = 'kids'), 'Piano', null, '🎹', 2, 'day',
        (now() at time zone 'UTC')::date - 5, 1, true, now() - interval '6 days', '00000000-0000-0000-0000-0000000000a5');
insert into public.check_ins (habit_id, user_id, local_date, period_start, status, created_at, logged_by, reviewed_by, reviewed_at)
select '00000000-0000-0000-0000-0000000000de', '00000000-0000-0000-0000-0000000000a5', d, d, 'approved', d + time '09:00',
       '00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a6', d + time '10:00'
  from generate_series(1, 5) i cross join generate_series(1, 2) n
 cross join lateral (select (now() at time zone 'UTC')::date - i as d) x;
set local session_replication_role = origin;
insert into t select 'pi' || i, (private.check_in_impl('00000000-0000-0000-0000-0000000000de', '00000000-0000-0000-0000-0000000000a5',
  date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')).id from generate_series(1, 2) i;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a6');
select public.review_check_ins(array(select v from t where k in ('pi1', 'pi2')), true);
reset role;
select is(array(select x.amount from public.xp_events x where x.reason = 'check_in'
                   and x.source_id in (select v::text from t where k in ('pi1', 'pi2'))
                 order by x.source_id::uuid), array[15, 10],
  'Approve all, two pending taps in one period: 15, then 10 (approved in check-in id order)');

select * from finish();
rollback;
