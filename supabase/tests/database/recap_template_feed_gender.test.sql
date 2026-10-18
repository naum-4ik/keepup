begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- Cleanup after 1.5.0: the weekly family recap's best carries its template id, and the Inbox feed
-- carries the kid's gender (the subject of every kid line).
select tests.create_user('00000000-0000-0000-0000-0000000c1ea1', 'cl-anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000c1eb1', 'cl-ben@example.com', '{"full_name":"Ben"}');
update public.profiles set timezone = 'Europe/Rome', week_start = 1, created_at = '2026-09-01'
 where id in ('00000000-0000-0000-0000-0000000c1ea1', '00000000-0000-0000-0000-0000000c1eb1');
create temp table t (k text primary key, v uuid) on commit drop;
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000c1ea1', 'Family', 'family')).id;
select private.accept_invite_impl('00000000-0000-0000-0000-0000000c1eb1',
  (private.create_invite_impl('00000000-0000-0000-0000-0000000c1ea1', (select v from t where k = 'fam'), now())).token, now());
update public.group_members set joined_at = '2026-09-01' where group_id = (select v from t where k = 'fam');

-- 1. The family recap: Dinner (from the g-family-dinner template) checked in once in the week of 28 Sep.
set local session_replication_role = replica;
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, requires_approval, created_at, created_by, template_id) values
  ('00000000-0000-0000-0000-0000000c1ed1', null, (select v from t where k = 'fam'), 'Family dinner', 'people', '🍝', 1, 'week', '2026-09-28', 1, false, '2026-09-28 08:00+02', '00000000-0000-0000-0000-0000000c1ea1', 'g-family-dinner');
set local session_replication_role = origin;
select private.check_in_impl('00000000-0000-0000-0000-0000000c1ed1', '00000000-0000-0000-0000-0000000c1ea1', '2026-09-30 20:00+02');
select private.enqueue_recaps('2026-10-05 10:05+02');
create temp table fr as
  select n.payload -> 'best' as best from public.notifications n
   where n.kind = 'family_recap' and n.group_id = (select v from t where k = 'fam') and n.user_id = '00000000-0000-0000-0000-0000000c1ea1';
select is((select best ->> 'template' from fr), 'g-family-dinner', 'family_recap: best carries the habit''s template id');
select is((select best ->> 'title' || ' ' || (best ->> 'length') || ' ' || (best ->> 'period') from fr), 'Family dinner 1 week',
  'family_recap: title, length and period unchanged');

-- 2. The feed: a kid check-in Anna logs reaches Ben with Mia's gender.
insert into t select 'kid', private.create_child_impl('00000000-0000-0000-0000-0000000c1ea1', (select v from t where k = 'fam'), 'Mia', '🦊', 'peach', true);
select private.set_child_gender_impl('00000000-0000-0000-0000-0000000c1ea1', (select v from t where k = 'kid'), 'girl');
insert into t select 'kidhabit', (private.create_child_habit_impl('00000000-0000-0000-0000-0000000c1ea1', (select v from t where k = 'kid'), 'Brush teeth', '🪥', 1, 'day', null)).id;
select private.check_in_impl((select v from t where k = 'kidhabit'), '00000000-0000-0000-0000-0000000c1ea1', now(), (select v from t where k = 'kid'));
select is((select f.subject_gender || ' ' || f.subject_name || ', logged by ' || f.actor_name
             from private.inbox_feed_impl('00000000-0000-0000-0000-0000000c1eb1', 50) f where f.kind = 'kid_check_in'),
  'girl Mia, logged by Anna', 'inbox_feed: a kid line carries the kid''s (subject''s) gender');
select is((select f.subject_gender from private.inbox_feed_impl('00000000-0000-0000-0000-0000000c1ea1', 50) f where f.kind = 'family_recap'),
  null, 'inbox_feed: no subject, no gender');
select ok('subject_gender' = any ((select p.proargnames from pg_proc p where p.oid = 'public.inbox_feed(int)'::regprocedure)::text[]),
  'public.inbox_feed returns subject_gender');
select ok(has_function_privilege('authenticated', 'public.inbox_feed(int)', 'execute')
          and not has_function_privilege('anon', 'public.inbox_feed(int)', 'execute'),
  'inbox_feed: authenticated only');

select * from finish();
rollback;
