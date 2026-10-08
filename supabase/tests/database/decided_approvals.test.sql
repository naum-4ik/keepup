begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Production deep test N1 (owner ruling): once a pending check-in is decided, its "Approve?" rows
-- read the outcome and count as read, for every reviewer. Other rows stay as they were.
select tests.create_user('00000000-0000-0000-0000-0000000004a1', 'dec-anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000004b1', 'dec-dan@example.com', '{"full_name":"Dan"}');
select tests.create_user('00000000-0000-0000-0000-0000000004c1', 'dec-eve@example.com', '{"full_name":"Eve"}');
create temp table t (k text primary key, v uuid) on commit drop;
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000004a1', 'Family', 'family')).id;
select private.accept_invite_impl('00000000-0000-0000-0000-0000000004b1',
  (private.create_invite_impl('00000000-0000-0000-0000-0000000004a1', (select v from t where k='fam'), now())).token, now());
select private.accept_invite_impl('00000000-0000-0000-0000-0000000004c1',
  (private.create_invite_impl('00000000-0000-0000-0000-0000000004a1', (select v from t where k='fam'), now())).token, now());
insert into t select 'gym', (private.create_group_habit_impl('00000000-0000-0000-0000-0000000004a1', (select v from t where k='fam'),
  'Gym', '🏋️', 'fitness', 1, 'day', null, true, '{}', now())).id;
insert into t select 'run', (private.create_group_habit_impl('00000000-0000-0000-0000-0000000004a1', (select v from t where k='fam'),
  'Run', '🏃', 'fitness', 1, 'day', null, true, '{}', now())).id;
insert into t select 'read', (private.create_group_habit_impl('00000000-0000-0000-0000-0000000004a1', (select v from t where k='fam'),
  'Read', '📚', 'learning', 1, 'day', null, true, '{}', now())).id;

-- Dan's Gym (approved later), Dan's Run (rejected later), Eve's Gym (stays pending), Eve's Read (expires).
insert into t select 'dan_gym', (private.check_in_impl((select v from t where k='gym'), '00000000-0000-0000-0000-0000000004b1', now())).id;
insert into t select 'dan_run', (private.check_in_impl((select v from t where k='run'), '00000000-0000-0000-0000-0000000004b1', now())).id;
insert into t select 'eve_gym', (private.check_in_impl((select v from t where k='gym'), '00000000-0000-0000-0000-0000000004c1', now())).id;
insert into t select 'eve_read', (private.check_in_impl((select v from t where k='read'), '00000000-0000-0000-0000-0000000004c1', now())).id;
-- An "expiring" row for Dan's Gym too, and Eve had already read hers a while ago.
select private.notify(array['00000000-0000-0000-0000-0000000004a1'::uuid], 'approval_expiring', 'expiring:' || (select v from t where k='dan_gym'),
  (select v from t where k='fam'), (select v from t where k='gym'), (select v from t where k='dan_gym'), '00000000-0000-0000-0000-0000000004b1', null, '{}'::jsonb);
update public.notifications set read_at = '2026-01-01T00:00:00Z'
 where user_id = '00000000-0000-0000-0000-0000000004c1' and check_in_id = (select v from t where k='dan_gym');

select is((select count(*)::int from public.notifications where kind = 'approval_needed' and check_in_id = (select v from t where k='dan_gym')),
  2, 'setup: Anna and Eve are asked to approve Dan''s Gym');
select is((select count(*)::int from public.notifications where kind in ('approval_needed', 'approval_expiring') and read_at is null
            and check_in_id = (select v from t where k='dan_gym')), 2, 'setup: Anna''s two rows are unread');

select private.review_check_in_impl((select v from t where k='dan_gym'), '00000000-0000-0000-0000-0000000004a1', true, now());
select is((select count(*)::int from public.notifications where kind in ('approval_needed', 'approval_expiring')
            and check_in_id = (select v from t where k='dan_gym') and read_at is null), 0, 'approved: every reviewer''s rows count as read');
select is((select array_agg(distinct payload->>'outcome') from public.notifications where kind in ('approval_needed', 'approval_expiring')
            and check_in_id = (select v from t where k='dan_gym')), array['approved'], 'approved: the rows carry the outcome');
select is((select read_at from public.notifications where user_id = '00000000-0000-0000-0000-0000000004c1'
            and check_in_id = (select v from t where k='dan_gym') and kind = 'approval_needed'),
  '2026-01-01T00:00:00Z'::timestamptz, 'a row read earlier keeps its read time');
select is((select count(*)::int from public.notifications where kind = 'approval_needed' and read_at is null and payload = '{}'::jsonb
            and check_in_id = (select v from t where k='eve_gym')), 2, 'another pending check-in''s rows stay unread and as they were');
select is((select count(*)::int from public.notifications where kind = 'group_habit_created' and read_at is null
            and user_id = '00000000-0000-0000-0000-0000000004b1'), 3, 'other kinds of rows stay unread');
select is((select count(*)::int from public.notifications where kind = 'check_in_approved' and user_id = '00000000-0000-0000-0000-0000000004b1'
            and read_at is null), 1, 'the author''s own "approved" row is new and unread');

select private.review_check_in_impl((select v from t where k='dan_run'), '00000000-0000-0000-0000-0000000004c1', false, now());
select is((select array_agg(distinct payload->>'outcome') from public.notifications where kind = 'approval_needed'
            and check_in_id = (select v from t where k='dan_run') and read_at is not null), array['rejected'], 'rejected: read, with the outcome');

update public.check_ins set status = 'expired' where id = (select v from t where k='eve_read');
select is((select array_agg(distinct payload->>'outcome') from public.notifications where kind = 'approval_needed'
            and check_in_id = (select v from t where k='eve_read') and read_at is not null), array['expired'], 'expired: read, with the outcome');

-- The rows stay in the feed (history; the 60-day purge goes by created_at).
select is((select count(*)::int from private.inbox_feed_impl('00000000-0000-0000-0000-0000000004a1', 50) f
            where f.kind = 'approval_needed' and f.check_in_id = (select v from t where k='dan_gym') and f.payload->>'outcome' = 'approved'),
  1, 'Anna''s Inbox still lists the row, with the outcome');

-- Rows decided before this migration: the backfill reads the check-in's status.
update public.notifications set read_at = null, payload = '{}'::jsonb where check_in_id = (select v from t where k='dan_run');
select private.mark_decided_approvals_read(null);
select is((select count(*)::int from public.notifications where kind = 'approval_needed' and check_in_id = (select v from t where k='dan_run')
            and read_at is not null and payload->>'outcome' = 'rejected'), 2, 'the backfill marks decided rows read, with the outcome');
select is((select count(*)::int from public.notifications where kind = 'approval_needed' and read_at is null
            and check_in_id = (select v from t where k='eve_gym')), 2, 'the backfill leaves pending check-ins alone');
select ok(not has_function_privilege('authenticated', 'private.mark_decided_approvals_read(uuid)', 'execute'), 'clients cannot call the helper');

select * from finish();
rollback;
