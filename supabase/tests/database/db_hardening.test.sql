begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

-- Follow-ups from the M3 final review (20261001100000_db_hardening.sql). Lock-order fixes can't be
-- raced in one session; their behaviour is covered by the existing tests and argued in the migration.

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');
select tests.create_user('00000000-0000-0000-0000-0000000000c1', 'carol@example.com', '{"full_name":"Carol"}');
select tests.create_user('00000000-0000-0000-0000-0000000000e1', 'eve@example.com', '{"full_name":"Eve"}');
update public.profiles set timezone = 'UTC'
 where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1',
              '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e1');

create temp table t (k text primary key, v text) on commit drop;
grant all on t to authenticated;

-- Acting as someone (auth.uid()) without leaving the postgres role; '' is "system" (cron, service).
create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when p_user is null then '' else json_build_object('sub', p_user)::text end, true);
end;
$$;
select pg_temp.act_as(null);

insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Family', 'family')).id;
insert into t select 'tok', (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'fam'), now())).token;
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000b1', (select v from t where k = 'tok'), now());

-- 1. A received treat goal can't be cancelled (the cancel locks the goal and re-checks it).
insert into t select 'mary', private.create_child_impl('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'fam'), 'Mary', '🐼', 'peach', true);
insert into t select 'goal', (private.set_treat_goal_impl('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'mary'), 'Park', '🛝', 1)).id;
update public.treat_goals set reached_at = now(), received_at = now() where id = (select v::uuid from t where k = 'goal');
select throws_ok($$select private.cancel_treat_goal_impl('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'goal'))$$,
  'P0002', 'keepup:goal_not_found', 'a received goal cannot be cancelled');
select ok(exists (select 1 from public.treat_goals where id = (select v::uuid from t where k = 'goal')), 'and it is kept');
insert into t select 'goal2', (private.set_treat_goal_impl('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'mary'), 'Ice cream', '🍦', 3)).id;
select lives_ok($$select private.cancel_treat_goal_impl('00000000-0000-0000-0000-0000000000b1', (select v::uuid from t where k = 'goal2'))$$,
  'an active goal is cancelled by any of her adults');
select ok(not exists (select 1 from public.treat_goals where id = (select v::uuid from t where k = 'goal2')), 'and it is gone');

-- 2. Invites: reused only with more than a day left; the older link stays valid until it expires.
insert into t select 'club', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Club', 'friends')).id;
insert into t select 'inv1', (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'club'), '2026-10-01T08:00:00Z')).token;
select is((private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'club'), '2026-10-06T08:00:00Z')).token,
  (select v from t where k = 'inv1'), 'two days left: the link is reused');
insert into t select 'inv2', (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'club'), '2026-10-07T09:00:00Z')).token;
select isnt((select v from t where k = 'inv2'), (select v from t where k = 'inv1'), 'under a day left: a new link');
select is((select expires_at from public.group_invites where token = (select v from t where k = 'inv2')),
  '2026-10-14T09:00:00Z'::timestamptz, 'the new link has the full 7 days');
select isnt_empty($$select * from private.invite_preview_impl((select v from t where k = 'inv1'), '2026-10-07T09:00:00Z')$$,
  'the older link still works until it expires');
select is_empty($$select * from private.invite_preview_impl((select v from t where k = 'inv1'), '2026-10-08T08:00:01Z')$$,
  'and then stops');
select is((private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'club'), '2026-10-07T10:00:00Z')).token,
  (select v from t where k = 'inv2'), 'the newest link is the one reused next');

-- 3 + 9. Resumed: only when a pause that has started ends early.
insert into t select 'dinner', (private.create_group_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'fam'),
  'Family dinner', '🍽️', 'people', 1, 'day', null, false, '{}', now())).id;
insert into t select 'walk', (private.create_group_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'fam'),
  'Walk', '🚶', 'fitness', 1, 'day', null, false, '{}', now())).id;
insert into t select 'today', private.habit_today(h, now())::text from public.habits h where h.id = (select v::uuid from t where k = 'dinner');

select private.freeze_habit_impl((select v::uuid from t where k = 'dinner'), '00000000-0000-0000-0000-0000000000a1',
  (select v::date + 1 from t where k = 'today'), (select v::date + 3 from t where k = 'today'), now());
select private.unfreeze_habit_impl((select v::uuid from t where k = 'dinner'), '00000000-0000-0000-0000-0000000000a1', now());
select is((select count(*)::int from public.notifications where kind = 'group_habit_resumed' and habit_id = (select v::uuid from t where k = 'dinner')),
  0, 'cancelling a pause that has not started is not a resume');

-- A pause that started two days ago, ended early by Anna.
insert into public.habit_freezes (habit_id, starts_on, created_by)
values ((select v::uuid from t where k = 'dinner'), (select v::date - 2 from t where k = 'today'), '00000000-0000-0000-0000-0000000000a1');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select private.unfreeze_habit_impl((select v::uuid from t where k = 'dinner'), '00000000-0000-0000-0000-0000000000a1', now());
select pg_temp.act_as(null);
select is((select count(*)::int from public.notifications where kind = 'group_habit_resumed' and habit_id = (select v::uuid from t where k = 'dinner')
            and user_id = '00000000-0000-0000-0000-0000000000b1' and actor_id = '00000000-0000-0000-0000-0000000000a1'),
  1, 'ending a started pause early tells the others, with Anna as the actor');
select is((select count(*)::int from public.notifications where kind = 'group_habit_resumed' and habit_id = (select v::uuid from t where k = 'dinner')
            and user_id = '00000000-0000-0000-0000-0000000000a1'),
  0, 'not Anna herself');
select is((select dedupe_key from public.notifications where kind = 'group_habit_resumed' and user_id = '00000000-0000-0000-0000-0000000000b1'
            and habit_id = (select v::uuid from t where k = 'dinner')),
  'group_habit_resumed:' || (select v from t where k = 'dinner') || ':' || (select v from t where k = 'today') || ':00000000-0000-0000-0000-0000000000b1',
  'keyed by the habit''s today');

-- A pause that starts today counts as started; deleting it with no signed-in actor is "system".
select private.freeze_habit_impl((select v::uuid from t where k = 'walk'), '00000000-0000-0000-0000-0000000000a1', null,
  (select v::date + 2 from t where k = 'today'), now());
select private.unfreeze_habit_impl((select v::uuid from t where k = 'walk'), '00000000-0000-0000-0000-0000000000a1', now());
select results_eq($$select user_id, actor_id from public.notifications
                    where kind = 'group_habit_resumed' and habit_id = (select v::uuid from t where k = 'walk') order by user_id$$,
  $$values ('00000000-0000-0000-0000-0000000000a1'::uuid, null::uuid), ('00000000-0000-0000-0000-0000000000b1'::uuid, null::uuid)$$,
  'a pause starting today, removed by the system: every adult hears it once, no actor');

-- 9. Archive with no signed-in actor: every adult once, no actor.
update public.habits set archived_at = now() where id = (select v::uuid from t where k = 'walk');
select results_eq($$select user_id, actor_id from public.notifications
                    where kind = 'group_habit_archived' and habit_id = (select v::uuid from t where k = 'walk') order by user_id$$,
  $$values ('00000000-0000-0000-0000-0000000000a1'::uuid, null::uuid), ('00000000-0000-0000-0000-0000000000b1'::uuid, null::uuid)$$,
  'a system archive tells each adult once, with no actor');

-- 9. Leaving and removal.
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000c1', (select v from t where k = 'tok'), now());
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000e1', (select v from t where k = 'tok'), now());
select private.leave_group_impl('00000000-0000-0000-0000-0000000000c1', (select v::uuid from t where k = 'fam'), false, now());
select results_eq($$select user_id, payload ->> 'removed' from public.notifications
                    where kind = 'member_left' and subject_id is null and actor_id = '00000000-0000-0000-0000-0000000000c1'$$,
  $$values ('00000000-0000-0000-0000-0000000000a1'::uuid, 'false')$$,
  'leaving with no signed-in actor: the admin hears "left", not "removed"');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select private.leave_group_impl('00000000-0000-0000-0000-0000000000e1', (select v::uuid from t where k = 'fam'), false, now());
select is((select payload ->> 'removed' from public.notifications where kind = 'member_left' and actor_id = '00000000-0000-0000-0000-0000000000e1'),
  'false', 'leaving as yourself: "left"');
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000e1', (select v from t where k = 'tok'), now() + interval '1 second');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select private.remove_member_impl('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'fam'), '00000000-0000-0000-0000-0000000000e1', now() + interval '2 seconds');
select pg_temp.act_as(null);
select is((select count(*)::int from public.notifications where kind = 'member_left' and actor_id = '00000000-0000-0000-0000-0000000000e1'
            and payload ->> 'removed' = 'true'),
  0, 'the removing admin is the only admin, so nobody else is told');

-- 9. Role changes with no signed-in actor: the subject hears it exactly once.
select private.set_member_role_impl('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'fam'), '00000000-0000-0000-0000-0000000000b1', 'admin');
select results_eq($$select user_id, actor_id, payload ->> 'role' from public.notifications
                    where kind = 'role_changed' and group_id = (select v::uuid from t where k = 'fam')$$,
  $$values ('00000000-0000-0000-0000-0000000000b1'::uuid, null::uuid, 'admin')$$,
  'a system role change tells the subject once, with no actor');

-- 9 + 6. Removal by a signed-in admin is "removed"; removing another admin needs no last-admin check.
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000c1', (select v from t where k = 'tok'), now() + interval '3 seconds');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select private.remove_member_impl('00000000-0000-0000-0000-0000000000b1', (select v::uuid from t where k = 'fam'), '00000000-0000-0000-0000-0000000000c1', now() + interval '4 seconds');
select pg_temp.act_as(null);
select results_eq($$select user_id, payload ->> 'removed' from public.notifications
                    where kind = 'member_left' and actor_id = '00000000-0000-0000-0000-0000000000c1' and payload ->> 'removed' = 'true'$$,
  $$values ('00000000-0000-0000-0000-0000000000a1'::uuid, 'true')$$,
  'removed by Dan: Anna hears "removed", Dan (the actor) and Carol do not');
select lives_ok($$select private.remove_member_impl('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'fam'), '00000000-0000-0000-0000-0000000000b1', now() + interval '5 seconds')$$,
  'an admin removes another admin');
select is((select role from public.group_members where group_id = (select v::uuid from t where k = 'fam') and user_id = '00000000-0000-0000-0000-0000000000a1' and left_at is null),
  'admin', 'and an admin remains');
select ok((select prosrc not like '%last_admin%' from pg_proc where oid = 'private.remove_member_impl(uuid, uuid, uuid, timestamptz)'::regprocedure),
  'remove_member_impl has no last-admin guard left');
select throws_ok($$select private.remove_member_impl('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'fam'), '00000000-0000-0000-0000-0000000000a1', now())$$,
  'P0001', 'keepup:use_leave', 'removing yourself still says use Leave');

-- 5. Restoring an approval habit inside its archive day's review window leaves that day to finalize.
insert into t select 'pair', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Pair', 'couple')).id;
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000b1',
  (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'pair'), now())).token, now());
update public.group_members set joined_at = '2026-09-01T00:00:00Z' where group_id = (select v::uuid from t where k = 'pair');
set local session_replication_role = replica;
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, requires_approval, created_at, created_by)
values ('00000000-0000-0000-0000-0000000000d5', null, (select v::uuid from t where k = 'pair'), 'Gym', 'fitness', '🏋️', 1, 'day',
        '2026-10-05', 1, true, '2026-10-04T00:00:00Z', '00000000-0000-0000-0000-0000000000a1');
set local session_replication_role = origin;
insert into t select 'gymci', (private.check_in_impl('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000b1', '2026-10-05T09:00:00Z')).id;
insert into t select 'gymci2', (private.check_in_impl('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000a1', '2026-10-05T10:00:00Z')).id;
select is((select array_agg(status) from public.check_ins where habit_id = '00000000-0000-0000-0000-0000000000d5'), array['pending', 'pending'],
  'both check-ins wait for the other''s approval');
-- Archived on 5 Oct (habit_rules stamps the real clock, so pin it), restored 6 Oct 08:00, before the 12:00 deadline.
set local session_replication_role = replica;
update public.habits set archived_at = '2026-10-05T18:00:00Z' where id = '00000000-0000-0000-0000-0000000000d5';
set local session_replication_role = origin;
select private.restore_habit_impl('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d5', '2026-10-06T08:00:00Z');
select is_empty($$select * from public.period_results where habit_id = '00000000-0000-0000-0000-0000000000d5'$$,
  'the archive day, still in review, is not settled by the restore');
select private.review_check_in_impl((select v::uuid from t where k = 'gymci'), '00000000-0000-0000-0000-0000000000a1', true, '2026-10-06T09:00:00Z');
select private.review_check_in_impl((select v::uuid from t where k = 'gymci2'), '00000000-0000-0000-0000-0000000000b1', true, '2026-10-06T09:05:00Z');
select private.finalize_periods('2026-10-06T13:00:00Z');
select results_eq($$select period_start::text, outcome from public.period_results where habit_id = '00000000-0000-0000-0000-0000000000d5'$$,
  $$values ('2026-10-05', 'done')$$, 'approved in the window, the day ends done');

-- 10. invite_membership: the group id for a current member, null for anyone else, signed-in only.
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1');
select is(public.invite_membership((select v from t where k = 'tok')), (select v::uuid from t where k = 'fam'), 'a current member gets the group id');
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select is(public.invite_membership((select v from t where k = 'tok')), null::uuid, 'a former member gets null');
select tests.authenticate_as('00000000-0000-0000-0000-0000000000e1');
select is(public.invite_membership((select v from t where k = 'tok')), null::uuid, 'an outsider gets null');
select is(public.invite_membership('not-a-token'), null::uuid, 'an unknown token gives null');
reset role;
select ok(not has_function_privilege('anon', 'public.invite_membership(text)', 'execute')
          and has_function_privilege('authenticated', 'public.invite_membership(text)', 'execute'),
  'signed-in users only');
select is((select count(*)::int from information_schema.routines r
            where r.specific_schema = 'public' and r.routine_name = 'invite_preview'
              and exists (select 1 from information_schema.parameters p
                           where p.specific_name = r.specific_name and p.parameter_mode = 'OUT' and p.parameter_name = 'group_id')),
  0, 'invite_preview still returns no group id');

select * from finish();
rollback;
