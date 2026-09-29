begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'hab-a@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'hab-b@example.com');
update public.profiles set timezone = 'Europe/Rome' where id = '00000000-0000-0000-0000-0000000000a1';

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1');

select lives_ok(
  $$insert into public.habits (title, category, target_count, period) values ('Read', 'learning', 1, 'day')$$,
  'a user creates a habit');
select is((select owner_id from public.habits where title = 'Read'),
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'the owner defaults to the signed-in user');
select is((select starts_on from public.habits where title = 'Read'),
  (now() at time zone 'Europe/Rome')::date, 'a habit starts today (in the owner''s time zone) by default');
select lives_ok(
  $$insert into public.habits (title, category, target_count, period, starts_on)
    values ('Run', 'fitness', 3, 'week', ((now() at time zone 'Europe/Rome')::date + 2))$$,
  'a habit can start later');
select throws_ok(
  $$insert into public.habits (title, category, target_count, period, starts_on)
    values ('Past', 'health', 1, 'day', ((now() at time zone 'Europe/Rome')::date - 1))$$,
  'P0001', 'keepup:start_in_past', 'a habit cannot start in the past');
select throws_ok(
  $$insert into public.habits (title, category, target_count, period, starts_on)
    values ('Far', 'health', 1, 'day', ((now() at time zone 'Europe/Rome')::date + 400))$$,
  'P0001', 'keepup:start_too_far', 'a habit cannot start more than a year ahead');
select throws_ok(
  $$insert into public.habits (owner_id, title, category, target_count, period)
    values ('00000000-0000-0000-0000-0000000000b1', 'Sneaky', 'home', 1, 'day')$$,
  '42501', null, 'a user cannot create a habit for someone else');
select throws_ok($$insert into public.habits (title, category, target_count, period) values ('   ', 'health', 1, 'day')$$,
  '23514', null, 'blank titles are rejected');
select throws_ok($$insert into public.habits (title, category, target_count, period) values (repeat('x', 61), 'health', 1, 'day')$$,
  '23514', null, 'titles longer than 60 characters are rejected');
select throws_ok($$insert into public.habits (title, category, target_count, period) values ('Walk ', 'fitness', 1, 'day')$$,
  '23514', null, 'titles with trailing spaces are rejected');
select throws_ok($$insert into public.habits (title, category, target_count, period) values ('Gym', 'fitness', 8, 'week')$$,
  '23514', null, 'a weekly habit can be at most 7 times a week');
select lives_ok($$insert into public.habits (title, category, target_count, period) values ('Water', 'health', 50, 'day')$$,
  'a daily habit can be up to 50 times a day');
select lives_ok($$insert into public.habits (title, category, target_count, period) values ('Budget', 'money', 31, 'month')$$,
  'a monthly habit can be up to 31 times a month');
select throws_ok($$update public.habits set target_count = 2 where title = 'Read'$$,
  '42501', null, 'target_count cannot be edited');
select throws_ok($$update public.habits set period = 'week' where title = 'Read'$$,
  '42501', null, 'period cannot be edited');
select lives_ok($$update public.habits set title = 'Read more' where title = 'Read'$$,
  'the title can be edited');
select throws_ok(
  $$update public.habits set starts_on = ((now() at time zone 'Europe/Rome')::date - 3) where title = 'Run'$$,
  'P0001', 'keepup:start_in_past', 'the start date cannot be moved into the past');

update public.habits set archived_at = '2000-01-01T00:00:00Z' where title = 'Budget';
select is((select archived_at from public.habits where title = 'Budget'), now(),
  'archiving stores the server time, not the client value');
update public.habits set archived_at = null where title = 'Budget';
select isnt((select archived_at from public.habits where title = 'Budget'), null,
  'an archived habit cannot be un-archived');

select throws_ok($$delete from public.habits where title = 'Water'$$,
  '42501', null, 'habits cannot be deleted directly');

select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.habits), 0, 'a user sees only their own habits');
update public.habits set title = 'hacked' where title = 'Read more';

reset role;
set local role anon;
select throws_ok($$select * from public.habits$$, '42501', null, 'anonymous visitors cannot read habits');
reset role;

select * from finish();
rollback;
