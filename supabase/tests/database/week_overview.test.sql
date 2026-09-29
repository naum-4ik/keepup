begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

select tests.create_user('00000000-0000-0000-0000-0000000000a7', 'wk-a@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000b7', 'wk-b@example.com');
update public.profiles set timezone = 'Europe/Rome', week_start = 1 where id = '00000000-0000-0000-0000-0000000000a7';

-- "Now" is Thursday 8 Oct 2026, 12:00 in Rome. This week: Mon 5 – Sun 11 Oct. Last week: 28 Sep – 4 Oct.
set local session_replication_role = replica;
insert into public.habits (id, owner_id, title, category, target_count, period, starts_on, created_at, week_start, archived_at) values
  ('00000000-0000-0000-0000-00000000d701', '00000000-0000-0000-0000-0000000000a7', 'Walk', 'fitness', 1, 'day', '2026-09-28', '2026-09-28T08:00:00Z', 1, null),
  ('00000000-0000-0000-0000-00000000d702', '00000000-0000-0000-0000-0000000000a7', 'Gym', 'fitness', 2, 'week', '2026-09-21', '2026-09-21T08:00:00Z', 1, null),
  ('00000000-0000-0000-0000-00000000d703', '00000000-0000-0000-0000-0000000000a7', 'Read', 'learning', 1, 'day', '2026-10-06', '2026-10-06T08:00:00Z', 1, null),
  ('00000000-0000-0000-0000-00000000d704', '00000000-0000-0000-0000-0000000000a7', 'Stretch', 'health', 1, 'day', '2026-10-08', '2026-10-08T07:00:00Z', 1, null),
  ('00000000-0000-0000-0000-00000000d705', '00000000-0000-0000-0000-0000000000a7', 'Budget', 'money', 1, 'month', '2026-09-01', '2026-09-01T08:00:00Z', 1, null),
  ('00000000-0000-0000-0000-00000000d706', '00000000-0000-0000-0000-0000000000a7', 'Old', 'home', 1, 'day', '2026-09-28', '2026-09-28T08:00:00Z', 1, null);
set local session_replication_role = origin;

-- Walk is paused on Wednesday 7 Oct.
insert into public.habit_freezes (habit_id, starts_on, ends_on)
values ('00000000-0000-0000-0000-00000000d701', '2026-10-07', '2026-10-07');

select private.check_in_impl(h, '00000000-0000-0000-0000-0000000000a7', t)
  from (values
    -- Walk: last week Mon–Wed done, Thu–Sun missed; this week Mon done, Tue missed, Wed paused, Thu open.
    ('00000000-0000-0000-0000-00000000d701'::uuid, '2026-09-28T08:00:00Z'::timestamptz),
    ('00000000-0000-0000-0000-00000000d701', '2026-09-29T08:00:00Z'),
    ('00000000-0000-0000-0000-00000000d701', '2026-09-30T08:00:00Z'),
    ('00000000-0000-0000-0000-00000000d701', '2026-10-05T08:00:00Z'),
    -- Gym (2 a week): last week 1 of 2 (missed); this week done on Wednesday.
    ('00000000-0000-0000-0000-00000000d702', '2026-09-29T08:00:00Z'),
    ('00000000-0000-0000-0000-00000000d702', '2026-10-05T08:00:00Z'),
    ('00000000-0000-0000-0000-00000000d702', '2026-10-07T08:00:00Z'),
    -- Read starts Tuesday (not done: its partial first day isn't a miss), done Wed and today.
    ('00000000-0000-0000-0000-00000000d703', '2026-10-07T08:00:00Z'),
    ('00000000-0000-0000-0000-00000000d703', '2026-10-08T08:00:00Z'),
    -- Budget (monthly): September finished on 29 Sep (last week), October on 5 Oct (this week).
    ('00000000-0000-0000-0000-00000000d705', '2026-09-29T08:00:00Z'),
    ('00000000-0000-0000-0000-00000000d705', '2026-10-05T08:00:00Z'),
    -- Old: checked in this week, then archived. It isn't part of the overview.
    ('00000000-0000-0000-0000-00000000d706', '2026-10-05T08:00:00Z')) as v(h, t);
update public.habits set archived_at = '2026-10-06T10:00:00Z' where id = '00000000-0000-0000-0000-00000000d706';

create temp table ov as
  select private.week_overview_impl('00000000-0000-0000-0000-0000000000a7', '2026-10-08T10:00:00Z') as o;

select is((select o->>'week_start' from ov), '2026-10-05', 'the week starts on the owner''s week start');
-- Walk 1/2 (Tue missed, Wed paused, Thu open), Gym 1/1, Read 2/2 (Tue skipped), Stretch 0/0 (open today), Budget 1/1.
select is((select (o->>'done')::int from ov), 5, 'done counts each daily day, a weekly habit once and a monthly finished this week');
select is((select (o->>'possible')::int from ov), 6, 'possible skips paused days, days before the start, and today''s open habits');
-- Walk 3/7, Gym 0/1, Budget 1/1.
select is((select row((o->>'prev_done')::int, (o->>'prev_possible')::int)::text from ov), '(4,9)', 'last week: 4 of 9');

select is((select array_agg(d->>'local_date' order by d->>'local_date') from ov, jsonb_array_elements(o->'days') d),
  array['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'],
  'seven days from the week start');
select is((select array_agg((d->>'daily_done') || '/' || (d->>'daily_possible') order by d->>'local_date') from ov, jsonb_array_elements(o->'days') d),
  array['1/1', '0/1', '1/1', '1/3', '0/0', '0/0', '0/0'],
  'per day: a paused day and a partial first day don''t count; today counts against all of today''s daily habits; future days are empty');

select is((select row((o->>'best_current_streak')::int, o->>'best_current_streak_title', o->>'best_current_streak_period')::text from ov),
  '(2,Budget,month)', 'the best current streak (ties go to the older habit)');
select is((select (o->>'check_ins')::int from ov), 6, 'check-ins this week on active habits');
select is((select (o->>'active_habits')::int from ov), 5, 'archived habits aren''t active');

select is((select array_agg(p->>'habit_id' order by ord) from ov, jsonb_array_elements(o->'per_habit') with ordinality as x(p, ord)),
  array['00000000-0000-0000-0000-00000000d705', '00000000-0000-0000-0000-00000000d702', '00000000-0000-0000-0000-00000000d701',
        '00000000-0000-0000-0000-00000000d703', '00000000-0000-0000-0000-00000000d704'],
  'per habit: every active habit, oldest first');
select is((select array_agg(c->>'status' order by c->>'period_start') from ov, jsonb_array_elements(o->'per_habit') p, jsonb_array_elements(p->'cells') c
            where p->>'habit_id' = '00000000-0000-0000-0000-00000000d701'),
  array['missed', 'missed', 'missed', 'done', 'missed', 'paused', 'open'], 'a daily habit: its last 7 days');
select is((select array_agg(c->>'status' order by c->>'period_start') from ov, jsonb_array_elements(o->'per_habit') p, jsonb_array_elements(p->'cells') c
            where p->>'habit_id' = '00000000-0000-0000-0000-00000000d703'),
  array['not_started', 'not_started', 'not_started', 'not_started', 'not_started', 'done', 'done'], 'a habit that started mid-week');
select is((select array_agg(c->>'status' order by c->>'period_start') from ov, jsonb_array_elements(o->'per_habit') p, jsonb_array_elements(p->'cells') c
            where p->>'habit_id' = '00000000-0000-0000-0000-00000000d702'),
  array['not_started', 'missed', 'done'], 'a weekly habit: its weeks so far (at most 7)');

-- Monday 12 Oct: the new week starts at 0 of 0 (Budget's October was already counted last week),
-- and last week closes: Walk 1/6, Gym 1/1, Read 2/5, Stretch 0/3 (its first day is partial), Budget 1/1.
select is((select row((o->>'done')::int, (o->>'possible')::int, (o->>'prev_done')::int, (o->>'prev_possible')::int)::text
             from (select private.week_overview_impl('00000000-0000-0000-0000-0000000000a7', '2026-10-12T06:00:00Z') as o) x),
  '(0,0,5,16)', 'a new week starts empty and a finished month isn''t counted twice');

select tests.authenticate_as('00000000-0000-0000-0000-0000000000a7');
select is((select (public.week_overview()->>'active_habits')::int), 5, 'the owner gets their overview through the API');
select throws_ok($$select private.week_overview_impl(auth.uid(), now())$$, '42501', null, 'API users cannot call the implementation');

select tests.authenticate_as('00000000-0000-0000-0000-0000000000b7');
select is((select row((o->>'done')::int, (o->>'possible')::int, (o->>'active_habits')::int, (o->>'check_ins')::int, o->'per_habit')::text
             from (select public.week_overview() as o) x),
  '(0,0,0,0,[])', 'another user sees none of it');

select ok(not has_function_privilege('anon', 'public.week_overview()', 'execute'), 'anonymous visitors cannot call it');

select * from finish();
rollback;
