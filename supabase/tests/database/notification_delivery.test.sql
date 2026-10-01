-- supabase/tests/database/notification_delivery.test.sql
-- Delivery per category: Sound / Silent (default) / Inbox only (PR 8 extension).
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');

create temp table t (k text primary key, v uuid) on commit drop;
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Family', 'family')).id;
insert into t select 'inv', (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), now())).id;
select private.accept_invite_impl('00000000-0000-0000-0000-0000000000b1', (select token from public.group_invites where id = (select v from t where k = 'inv')), now());
insert into t select 'gym', (private.create_group_habit_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'),
  'Gym', '🏋️', 'fitness', 1, 'day', null, false, '{}', now())).id;

-- A feed row for Dan, as the app's events write it (the triggers set category and push).
create function pg_temp.feed_for_dan(p_kind text) returns uuid language sql as $$
  insert into public.notifications (user_id, kind, group_id, habit_id, actor_id, payload)
  values ('00000000-0000-0000-0000-0000000000b1', p_kind, (select v from t where k = 'fam'), (select v from t where k = 'gym'),
          '00000000-0000-0000-0000-0000000000a1', '{"kind":"you_got_this"}')
  returning id;
$$;

-- Default: no preference row → pushed, silently.
insert into t select 'n1', pg_temp.feed_for_dan('nudge');
select ok((select push from public.notifications where id = (select v from t where k = 'n1')), 'with no preference row a nudge is pushed');
select is(public.push_job((select v from t where k = 'n1'), now()) -> 'silent', 'true'::jsonb, 'silently: no sound, no vibration by default');
insert into t select 'r1', pg_temp.feed_for_dan('check_in_rejected');
select is(public.push_job((select v from t where k = 'r1'), now()) -> 'silent', 'true'::jsonb, '"always" kinds (no preference row) are silent too');

-- Sound
select private.set_notification_delivery_impl('00000000-0000-0000-0000-0000000000b1', 'nudges', 'sound');
select is((select delivery from public.notification_prefs where user_id = '00000000-0000-0000-0000-0000000000b1' and category = 'nudges'),
  'sound', 'Dan picks Sound for Nudges');
insert into t select 'n2', pg_temp.feed_for_dan('nudge');
select is(public.push_job((select v from t where k = 'n2'), now()) -> 'silent', 'false'::jsonb, 'Sound: the push may ring');
select is(public.push_job((select v from t where k = 'r1'), now()) -> 'silent', 'true'::jsonb, 'other categories keep their own delivery');

-- Inbox only
select private.set_notification_delivery_impl('00000000-0000-0000-0000-0000000000b1', 'nudges', 'inbox');
insert into t select 'n3', pg_temp.feed_for_dan('nudge');
select ok((select not push from public.notifications where id = (select v from t where k = 'n3')), 'Inbox only: in the feed, no push');
select ok(not (select enabled from public.notification_prefs where user_id = '00000000-0000-0000-0000-0000000000b1' and category = 'nudges'),
  'and enabled follows (false)');
select ok(private.push_allowed('00000000-0000-0000-0000-0000000000b1', 'check_in_rejected', null, (select v from t where k = 'fam'), '{}', now()),
  '"always" kinds ignore delivery');

-- The old on/off writer still works, and keeps enabled and delivery in step.
select private.set_notification_pref_impl('00000000-0000-0000-0000-0000000000b1', 'nudges', true);
select is((select delivery from public.notification_prefs where user_id = '00000000-0000-0000-0000-0000000000b1' and category = 'nudges'),
  'silent', 'turning a category on from Inbox only makes it Silent');
select private.set_notification_delivery_impl('00000000-0000-0000-0000-0000000000b1', 'nudges', 'sound');
select private.set_notification_pref_impl('00000000-0000-0000-0000-0000000000b1', 'nudges', true);
select is((select delivery from public.notification_prefs where user_id = '00000000-0000-0000-0000-0000000000b1' and category = 'nudges'),
  'sound', 'and keeps Sound when it was already on');
select private.set_notification_pref_impl('00000000-0000-0000-0000-0000000000b1', 'group_updates', false);
select is((select delivery from public.notification_prefs where user_id = '00000000-0000-0000-0000-0000000000b1' and category = 'group_updates'),
  'inbox', 'off (as the backfill maps enabled = false) is Inbox only');
select throws_ok($$insert into public.notification_prefs (user_id, category, enabled, delivery)
                   values ('00000000-0000-0000-0000-0000000000a1', 'approvals', false, 'silent')$$,
  '23514', null, 'enabled and delivery cannot disagree');

-- Refusals and privileges
select throws_ok($$select private.set_notification_delivery_impl('00000000-0000-0000-0000-0000000000b1', 'nudges', 'loud')$$,
  'P0001', 'keepup:invalid_choice', 'an unknown delivery is refused');
select throws_ok($$select private.set_notification_delivery_impl('00000000-0000-0000-0000-0000000000b1', 'nudges', null)$$,
  'P0001', 'keepup:invalid_choice', 'so is none');
select throws_ok($$select private.set_notification_delivery_impl('00000000-0000-0000-0000-0000000000b1', 'marketing', 'silent')$$,
  'P0001', 'keepup:invalid_choice', 'and an unknown category');
select ok(not has_function_privilege('anon', 'public.set_notification_delivery(text, text)', 'execute'), 'anonymous visitors cannot call it');

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1');
select public.set_notification_delivery('approvals', 'inbox');
select is((select delivery from public.notification_prefs where category = 'approvals'), 'inbox', 'Anna sets her own delivery');
select throws_ok($$select public.set_notification_delivery('approvals', 'vibrate')$$,
  'P0001', 'keepup:invalid_choice', 'through the wrapper too');
reset role;
select is((select count(*)::int from public.notification_prefs where user_id = '00000000-0000-0000-0000-0000000000b1' and category = 'approvals'),
  0, 'and only her own');

select * from finish();
rollback;
