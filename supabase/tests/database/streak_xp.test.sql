-- supabase/tests/database/streak_xp.test.sql
-- Streak-scaled check-in XP: 10 + min(streak before the check-in, 20). Every time is pinned (p_now,
-- tapped_at, review times), and the seeded history is fixed, so nothing depends on the real date.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- finalize_periods scans every habit; start from none (rolled back at the end).
delete from public.habits;

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');
update public.profiles set timezone = 'Europe/Rome' where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1');

create temp table t (k text primary key, v uuid) on commit drop;
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Family', 'family')).id;
insert into t select 'inv', (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), '2026-09-01 08:00+02')).id;
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000b1', (select token from public.group_invites where id = (select v from t where k = 'inv')), '2026-09-01 08:00+02');
update public.group_members set joined_at = '2026-09-01' where group_id = (select v from t where k = 'fam');
insert into t select 'mary', private.create_child_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), 'Mary', '🐼', 'peach', true);

-- e1 Read (Anna, from 1 Oct), e2 Walk (Anna, a long history), e3 Stretch (Anna, a mixed history),
-- e4 Water (Anna, a late tap), e5 Gym (the family, approval), e6 Brush teeth (Mary), e7 Family walk
-- (the family, Mary taking part).
set local session_replication_role = replica;
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, requires_approval, created_at, created_by)
select x.id::uuid, x.owner::uuid, x.grp, x.title, null, '⭐', 1, 'day', x.starts::date, 1, x.appr, (x.starts || ' 08:00+02')::timestamptz,
       '00000000-0000-0000-0000-0000000000a1'
  from (values
    ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', null::uuid, 'Read', '2026-10-01', false),
    ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a1', null, 'Walk', '2026-09-01', false),
    ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000a1', null, 'Stretch', '2026-09-01', false),
    ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000a1', null, 'Water', '2026-09-01', false),
    ('00000000-0000-0000-0000-0000000000e5', null, (select v from t where k = 'fam'), 'Gym', '2026-09-01', true),
    ('00000000-0000-0000-0000-0000000000e6', (select v::text from t where k = 'mary'), null, 'Brush teeth', '2026-10-01', false),
    ('00000000-0000-0000-0000-0000000000e7', null, (select v from t where k = 'fam'), 'Family walk', '2026-10-01', false)
  ) x(id, owner, grp, title, starts, appr);
-- Family walk: Mary takes part.
insert into public.group_habit_participants (habit_id, profile_id) values ('00000000-0000-0000-0000-0000000000e7', (select v from t where k = 'mary'));
-- Walk: 1–25 Sep done. Stretch: 1–2 done, 3 missed, 4 done, 5 rested, 6 skipped, 7 done.
-- Water: 1–3 done, 4 missed, 5 done.
insert into public.period_results (habit_id, period_start, outcome, finalized_at)
select '00000000-0000-0000-0000-0000000000e2'::uuid, '2026-09-01'::date + i, 'done', '2026-09-01'::timestamptz + make_interval(days => i + 1)
  from generate_series(0, 24) i
union all
select '00000000-0000-0000-0000-0000000000e3'::uuid, ('2026-09-0' || d)::date, o, ('2026-09-0' || d || ' 23:59+02')::timestamptz
  from (values (1, 'done'), (2, 'done'), (3, 'missed'), (4, 'done'), (5, 'rested'), (6, 'skipped'), (7, 'done')) s(d, o)
union all
select '00000000-0000-0000-0000-0000000000e4'::uuid, ('2026-09-0' || d)::date, o, ('2026-09-0' || d || ' 23:59+02')::timestamptz
  from (values (1, 'done'), (2, 'done'), (3, 'done'), (4, 'missed'), (5, 'done')) s(d, o);
-- Gym: Dan did his part on 1–2 Sep (approved); Anna didn't, so the family's days were missed.
insert into public.check_ins (habit_id, user_id, local_date, period_start, status, created_at, logged_by, reviewed_by, reviewed_at)
select '00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000b1', '2026-09-01'::date + i, '2026-09-01'::date + i, 'approved',
       '2026-09-01 09:00+02'::timestamptz + make_interval(days => i), '00000000-0000-0000-0000-0000000000b1',
       '00000000-0000-0000-0000-0000000000a1', '2026-09-01 10:00+02'::timestamptz + make_interval(days => i)
  from generate_series(0, 1) i;
insert into public.period_results (habit_id, period_start, outcome, finalized_at) values
  ('00000000-0000-0000-0000-0000000000e5', '2026-09-01', 'missed', '2026-09-02 12:15+02'),
  ('00000000-0000-0000-0000-0000000000e5', '2026-09-02', 'missed', '2026-09-03 12:15+02');
set local session_replication_role = origin;

create temp view granted as
  select x.source_id, x.amount from public.xp_events x where x.reason = 'check_in' and x.source_type = 'check_in';
create function pg_temp.amount_of(p_check_in uuid) returns int language sql as $$
  select amount from granted where source_id = p_check_in::text;
$$;

-- 1–3. A run of days, none settled yet (finalize hasn't run): 10, 11, … 15 on the 6th day.
insert into t select 'r' || d, (private.check_in_impl('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1',
  ('2026-10-0' || d || ' 09:00+02')::timestamptz)).id from generate_series(1, 6) d;
select is(pg_temp.amount_of((select v from t where k = 'r1')), 10, 'day 1 earns 10');
select is(pg_temp.amount_of((select v from t where k = 'r6')), 15, 'the 6th day in a row earns 15 (a 5-day streak before it)');
select is(array(select pg_temp.amount_of((select v from t where k = 'r' || d)) from generate_series(1, 6) d), array[10, 11, 12, 13, 14, 15],
  'one more per day of the streak, before finalization settles any of them');

-- 4. A resend of the same tap pays nothing more (the same ledger key).
insert into t select 'rs', (private.check_in_impl('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1',
  '2026-10-07 09:00+02', null, false, 'c0000000-0000-0000-0000-0000000000a7', '2026-10-07 08:59+02')).id;
select private.check_in_impl('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1',
  '2026-10-07 09:01+02', null, false, 'c0000000-0000-0000-0000-0000000000a7', '2026-10-07 08:59+02');
select is((select array_agg(amount) from granted where source_id = (select v::text from t where k = 'rs')), array[16], 'a resend pays nothing more');

-- 5–6. Undo takes back exactly what was granted.
select private.undo_check_in_impl((select v from t where k = 'r6'), '00000000-0000-0000-0000-0000000000a1', '2026-10-06 10:00+02');
select is((select amount from public.xp_events where reason = 'check_in_undone' and source_id = (select v::text from t where k = 'r6')), -15,
  'undo inserts the exact negative of the 15');
select is((select sum(amount)::int from public.xp_events where source_id = (select v::text from t where k = 'r6')), 0, 'which nets to nothing');

-- 7–8. The cap: +20 at most.
insert into t select 'w', (private.check_in_impl('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a1', '2026-09-26 09:00+02')).id;
select is(pg_temp.amount_of((select v from t where k = 'w')), 30, 'a 25-day streak earns 30, the cap');
select is(private.check_in_streak((select h from public.habits h where h.id = '00000000-0000-0000-0000-0000000000e2'),
  '00000000-0000-0000-0000-0000000000a1', '2026-09-21', '2026-09-21 09:00+02'), 20, 'a 20-day streak is the first that reaches it');

-- 9. Rested and skipped pass over; missed stops.
insert into t select 's', (private.check_in_impl('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000a1', '2026-09-08 09:00+02')).id;
select is(pg_temp.amount_of((select v from t where k = 's')), 12, 'rested and skipped days pass over, a missed day ends it (7, 4 → 12)');

-- 10–11. A late tap (offline) counts the streak as of its own period, and upgrades it.
insert into t select 'late', (private.check_in_impl('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000a1',
  '2026-09-06 09:00+02', null, false, 'c0000000-0000-0000-0000-0000000000a8', '2026-09-04 20:00+02')).id;
select is((select outcome from public.period_results where habit_id = '00000000-0000-0000-0000-0000000000e4' and period_start = '2026-09-04'), 'done',
  'setup: the late tap upgraded 4 Sep');
select is(pg_temp.amount_of((select v from t where k = 'late')), 13, 'it earns the streak before 4 Sep (3 days), not today''s');

-- 12–14. Group habit, approval: Dan's own part counts (the family missed 1–2 Sep), and the amount is
-- decided when it is approved.
insert into t select 'g3', (private.check_in_impl('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000b1', '2026-09-03 09:00+02')).id;
insert into t select 'g4', (private.check_in_impl('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000b1', '2026-09-04 09:00+02')).id;
select is((select count(*)::int from granted where source_id in ((select v::text from t where k = 'g3'), (select v::text from t where k = 'g4'))), 0,
  'pending check-ins earn nothing yet');
select private.review_check_in_impl((select v from t where k = 'g3'), '00000000-0000-0000-0000-0000000000a1', true, '2026-09-04 10:00+02');
select private.review_check_in_impl((select v from t where k = 'g4'), '00000000-0000-0000-0000-0000000000a1', true, '2026-09-04 10:05+02');
select is(pg_temp.amount_of((select v from t where k = 'g3')), 12, 'a group habit counts the person''s own part (2 days), not the family''s missed days');
select is(pg_temp.amount_of((select v from t where k = 'g4')), 13,
  'decided at approval: 3 Sep, approved just before, counts although it was still pending when 4 Sep was tapped');

-- 15–16. A day in its approval grace that isn't done yet neither adds nor ends the streak; once the
-- grace is over, it ends it.
select is(private.check_in_streak((select h from public.habits h where h.id = '00000000-0000-0000-0000-0000000000e5'),
  '00000000-0000-0000-0000-0000000000b1', '2026-09-06', '2026-09-06 10:00+02'), 4,
  'Dan, in grace: 5 Sep (not done yet) passes over, 1–4 Sep count');
select is(private.check_in_streak((select h from public.habits h where h.id = '00000000-0000-0000-0000-0000000000e5'),
  '00000000-0000-0000-0000-0000000000b1', '2026-09-06', '2026-09-06 13:00+02'), 0,
  'after the grace, 5 Sep is missed: 0');

-- 17. A child, behind the scenes.
select private.check_in_impl('00000000-0000-0000-0000-0000000000e6', '00000000-0000-0000-0000-0000000000a1', '2026-10-01 19:00+02', (select v from t where k = 'mary'));
insert into t select 'm2', (private.check_in_impl('00000000-0000-0000-0000-0000000000e6', '00000000-0000-0000-0000-0000000000a1', '2026-10-02 19:00+02',
  (select v from t where k = 'mary'))).id;
select is(pg_temp.amount_of((select v from t where k = 'm2')), 11, 'a child''s second day in a row earns the child 11');

-- 18. A child on a group habit: her own part counts (the adults never checked in, so the family's
-- days aren't done).
select private.check_in_impl('00000000-0000-0000-0000-0000000000e7', '00000000-0000-0000-0000-0000000000a1', '2026-10-01 18:00+02', (select v from t where k = 'mary'));
select private.check_in_impl('00000000-0000-0000-0000-0000000000e7', '00000000-0000-0000-0000-0000000000a1', '2026-10-02 18:00+02', (select v from t where k = 'mary'));
insert into t select 'mw', (private.check_in_impl('00000000-0000-0000-0000-0000000000e7', '00000000-0000-0000-0000-0000000000a1', '2026-10-03 18:00+02',
  (select v from t where k = 'mary'))).id;
select is(pg_temp.amount_of((select v from t where k = 'mw')), 12, 'a child''s own part of a group habit: the 3rd day earns 12');

select * from finish();
rollback;
