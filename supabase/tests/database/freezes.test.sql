begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select tests.create_user('00000000-0000-0000-0000-0000000000a3', 'frz-a@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000b3', 'frz-b@example.com');
update public.profiles set timezone = 'Europe/Rome' where id = '00000000-0000-0000-0000-0000000000a3';
set local session_replication_role = replica;
insert into public.habits (id, owner_id, title, category, target_count, period, starts_on, created_at)
values ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a3', 'Walk', 'fitness', 1, 'day', '2026-09-01', '2026-09-01T08:00:00Z');
set local session_replication_role = origin;

-- "Today" is Monday 5 Oct 2026 in Rome.
select throws_ok(
  $$select private.freeze_habit_impl('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a3',
      '2026-10-04', null, '2026-10-05T10:00:00Z')$$,
  'P0001', 'keepup:freeze_in_past', 'a pause cannot start in the past');
select lives_ok(
  $$select private.freeze_habit_impl('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a3',
      '2026-10-05', '2026-10-08', '2026-10-05T10:00:00Z')$$,
  'a pause can start today');
select throws_ok(
  $$select private.freeze_habit_impl('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a3',
      '2026-10-08', '2026-10-10', '2026-10-05T10:00:00Z')$$,
  'P0001', 'keepup:freeze_overlaps', 'pauses cannot overlap');
select throws_ok(
  $$select private.freeze_habit_impl('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a3',
      '2026-10-12', '2026-10-11', '2026-10-05T10:00:00Z')$$,
  'P0001', 'keepup:freeze_range_invalid', 'a pause cannot end before it starts');
select lives_ok(
  $$select private.freeze_habit_impl('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a3',
      '2026-10-20', null, '2026-10-05T10:00:00Z')$$,
  'an open-ended pause can be planned');

select ok(private.is_frozen('00000000-0000-0000-0000-00000000f001', '2026-10-07', '2026-10-08'), '7 Oct is paused');
select ok(not private.is_frozen('00000000-0000-0000-0000-00000000f001', '2026-10-04', '2026-10-05'), '4 Oct is not paused');

-- Resuming on 7 Oct: the running pause ends yesterday, the future one disappears.
select private.unfreeze_habit_impl('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a3', '2026-10-07T10:00:00Z');
select is((select ends_on from public.habit_freezes where starts_on = '2026-10-05'), '2026-10-06'::date,
  'resuming ends the running pause yesterday');
select is((select count(*)::int from public.habit_freezes where starts_on = '2026-10-20'), 0,
  'resuming removes pauses that had not started');

select throws_ok(
  $$select private.freeze_habit_impl('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000b3',
      '2026-11-01', null, '2026-10-05T10:00:00Z')$$,
  'P0002', 'keepup:habit_not_found', 'a user cannot pause someone else''s habit');

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a3');
select lives_ok($$select public.freeze_habit('00000000-0000-0000-0000-00000000f001', '2099-01-01')$$,
  'the owner can pause through the API');
select throws_ok(
  $$select private.freeze_habit_impl('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a3',
      '2099-02-01', null, now())$$,
  '42501', null, 'API users cannot call the rule implementation directly');
select ok((select count(*) from public.habit_freezes) > 0, 'the owner can read their pauses');

select tests.authenticate_as('00000000-0000-0000-0000-0000000000b3');
select is((select count(*)::int from public.habit_freezes), 0, 'others cannot read them');

select * from finish();
rollback;
