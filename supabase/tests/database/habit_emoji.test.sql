begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- Money is now Work & money.
select ok('work_money' = any(enum_range(null::public.habit_category)::text[]), 'the category is work_money');
select ok(not ('money' = any(enum_range(null::public.habit_category)::text[])), 'money is gone');

-- The backfill rule: an exact template title gets the template's emoji, anything else the category default.
select is(private.backfill_emoji('Drink water', 'health'), '💧', 'a template title gets its emoji');
select is(private.backfill_emoji('Yoga', 'fitness'), '🧘‍♀️', 'a ZWJ template emoji is kept whole');
select is(private.backfill_emoji('Weekly budget check', 'work_money'), '📊', 'a Work & money template gets its emoji');
select is(private.backfill_emoji('Take the stairs', 'fitness'), '👟', 'a removed template gets the category default');
select is(private.backfill_emoji('drink water', 'health'), '🍎', 'the match is exact (case matters)');
select is(private.backfill_emoji('Budget', 'work_money'), '💼', 'a custom title gets the category default');
select is(
  (select array_agg(private.default_emoji(c) order by c) from unnest(enum_range(null::public.habit_category)) c),
  array['🍎', '👟', '🌿', '📚', '💛', '🏠', '💼', '🚫'],
  'every category has a default emoji');

select tests.create_user('00000000-0000-0000-0000-0000000000e1', 'emoji-a@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000e2', 'emoji-b@example.com');
select tests.authenticate_as('00000000-0000-0000-0000-0000000000e1');

-- Insert: without an emoji (older clients) the category default is filled in.
insert into public.habits (title, category, target_count, period) values ('Budget', 'work_money', 1, 'week');
select is((select emoji from public.habits where title = 'Budget'), '💼', 'an insert without an emoji gets the category default');
insert into public.habits (title, emoji, category, target_count, period) values ('Blank', ' ', 'home', 1, 'day');
select is((select emoji from public.habits where title = 'Blank'), '🏠', 'a blank emoji also gets the category default');
select lives_ok(
  $$insert into public.habits (title, emoji, category, target_count, period) values ('Paint', '🎨', 'mind', 1, 'day')$$,
  'a client can insert its own emoji');
select is((select emoji from public.habits where title = 'Paint'), '🎨', 'the chosen emoji is kept');

-- The check constraint and not null.
select throws_ok(
  $$insert into public.habits (title, emoji, category, target_count, period) values ('Long', repeat('x', 17), 'mind', 1, 'day')$$,
  '23514', null, 'an emoji longer than 16 characters is rejected');
select throws_ok($$update public.habits set emoji = '' where title = 'Paint'$$,
  '23514', null, 'the emoji cannot be emptied');
select throws_ok($$update public.habits set emoji = null where title = 'Paint'$$,
  '23502', null, 'the emoji cannot be removed');

-- Update: the owner can change it; nobody else can.
select lives_ok($$update public.habits set emoji = '🖌️' where title = 'Paint'$$, 'the owner can change the emoji');
select is((select emoji from public.habit_summaries() where title = 'Paint'), '🖌️', 'summaries return the emoji');

select tests.authenticate_as('00000000-0000-0000-0000-0000000000e2');
update public.habits set emoji = '💀' where title = 'Paint';
reset role;
select is((select emoji from public.habits where title = 'Paint'), '🖌️', 'another user cannot change the emoji');
select is(
  (select emoji from private.habit_summaries('00000000-0000-0000-0000-0000000000e1', now()) where title = 'Budget'),
  '💼', 'the private summaries carry the emoji too');

select * from finish();
rollback;
