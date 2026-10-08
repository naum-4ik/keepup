begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');
update public.profiles set timezone = 'UTC' where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1');

create temp table t (k text primary key, v uuid) on commit drop;
-- Anna's daily "Read", from 1 Oct.
with h as (insert into public.habits (owner_id, title, category, target_count, period, starts_on)
           values ('00000000-0000-0000-0000-0000000000a1', 'Read', 'learning', 1, 'day', current_date) returning id)
insert into t select 'read', id from h;
set local session_replication_role = replica; -- the rules refuse a past start: backdate without triggers
update public.habits set starts_on = '2026-10-01', created_at = '2026-09-30T08:00:00Z' where id = (select v from t where k = 'read');
set local session_replication_role = origin;

-- Setting the end
select throws_ok($$select private.set_habit_end_impl('00000000-0000-0000-0000-0000000000b1', (select v from t where k = 'read'), '2026-10-03', '2026-10-01T08:00:00Z')$$,
  'P0002', 'keepup:habit_not_found', 'only the owner sets the end of a private habit');
select throws_ok($$select private.set_habit_end_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'read'), '2026-09-30', '2026-10-01T08:00:00Z')$$,
  'P0001', 'keepup:end_too_early', 'the end cannot be before today');
select lives_ok($$select private.set_habit_end_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'read'), '2026-10-05', '2026-10-01T08:00:00Z')$$,
  'the owner sets an end');
select throws_ok($$select private.set_habit_end_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'read'), '2026-10-04', '2026-10-01T09:00:00Z')$$,
  'P0001', 'keepup:end_too_early', 'an end can be extended or removed, not brought earlier');
select lives_ok($$select private.set_habit_end_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'read'), null, '2026-10-01T09:00:00Z')$$,
  'an end can be removed');
-- (Back to the plan: 1–3 Oct. Set as the table owner, since "earlier" isn't allowed through the rule.)
update public.habits set ends_on = '2026-10-03' where id = (select v from t where k = 'read');

-- While it runs, and after it
select lives_ok($$select private.check_in_impl((select v from t where k = 'read'), '00000000-0000-0000-0000-0000000000a1', '2026-10-01T09:00:00Z')$$, 'day 1: check-in');
select lives_ok($$select private.check_in_impl((select v from t where k = 'read'), '00000000-0000-0000-0000-0000000000a1', '2026-10-02T09:00:00Z')$$, 'day 2: check-in');
select throws_ok($$select private.keep_going_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'read'), '2026-10-03T09:00:00Z')$$,
  'P0001', 'keepup:habit_not_ended', 'the last day still runs, so there is nothing to decide yet');
select throws_ok($$select private.check_in_impl((select v from t where k = 'read'), '00000000-0000-0000-0000-0000000000a1', '2026-10-04T09:00:00Z')$$,
  'P0001', 'keepup:habit_ended', 'no check-ins after the end');

select private.finalize_periods('2026-10-05T13:00:00Z');
select results_eq($$select period_start::text, outcome from public.period_results where habit_id = (select v from t where k = 'read') order by 1$$,
  $$values ('2026-10-01', 'done'), ('2026-10-02', 'done'), ('2026-10-03', 'missed'), ('2026-10-04', 'skipped')$$,
  'the days after the end are skipped, not missed');
select results_eq($$select done, total, best_streak from private.habit_finish_summary_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'read'), '2026-10-05T13:00:00Z')$$,
  $$values (2, 3, 2)$$, 'the finish card: 2 of 3 days, best streak 2');
select throws_ok($$select * from private.habit_finish_summary_impl('00000000-0000-0000-0000-0000000000b1', (select v from t where k = 'read'), '2026-10-05T13:00:00Z')$$,
  'P0002', 'keepup:habit_not_found', 'someone else cannot read it');

-- Keep going: the gap is settled as skipped, the end is removed, and check-ins work again.
select lives_ok($$select private.keep_going_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'read'), '2026-10-07T09:00:00Z')$$, 'keep going');
select results_eq($$select outcome from public.period_results where habit_id = (select v from t where k = 'read') and period_start in ('2026-10-05', '2026-10-06') order by period_start$$,
  $$values ('skipped'), ('skipped')$$, 'the days waiting for the decision are skipped');
select is((select ends_on from public.habits where id = (select v from t where k = 'read')), null, 'the end is gone');
select lives_ok($$select private.check_in_impl((select v from t where k = 'read'), '00000000-0000-0000-0000-0000000000a1', '2026-10-07T10:00:00Z')$$, 'and check-ins work again');

-- Finish (a second habit, ended the same way)
with h as (insert into public.habits (owner_id, title, category, target_count, period, starts_on, ends_on)
           values ('00000000-0000-0000-0000-0000000000a1', 'Stretch', 'fitness', 1, 'day', current_date, null) returning id)
insert into t select 'stretch', id from h;
set local session_replication_role = replica; -- the rules refuse a past start: backdate without triggers
update public.habits set starts_on = '2026-10-01', ends_on = '2026-10-02', created_at = '2026-09-30T08:00:00Z' where id = (select v from t where k = 'stretch');
set local session_replication_role = origin;
select lives_ok($$select private.finish_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'stretch'), '2026-10-04T09:00:00Z')$$, 'finish');
select ok((select archived_at is not null and finished_at is not null from public.habits where id = (select v from t where k = 'stretch')),
  'a finished habit is archived and marked finished, history kept');
-- Group habits: admins decide.
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Family', 'family')).id;
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000b1',
  (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), now())).token, now());
insert into t select 'dinner', (private.create_group_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'),
  'Family dinner', '🍽️', 'people', 1, 'week', null, false, '{}', now())).id;
select throws_ok($$select private.set_habit_end_impl('00000000-0000-0000-0000-0000000000b1', (select v from t where k = 'dinner'), (current_date + 60), now())$$,
  'P0001', 'keepup:not_admin', 'on a group habit only an admin sets the end');
select ok(not has_function_privilege('anon', 'public.finish_habit(uuid)', 'execute') and not has_function_privilege('anon', 'public.set_habit_end(uuid, date)', 'execute'),
  'signed-out visitors cannot change ends');

select * from finish();
rollback;
