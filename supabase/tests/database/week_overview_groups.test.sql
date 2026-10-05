begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Today's "This week" counts the group habits you take part in (20261009120000), judged for you.
select tests.create_user('00000000-0000-0000-0000-0000000000a8', 'wkg-anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b8', 'wkg-dan@example.com', '{"full_name":"Dan"}');
select tests.create_user('00000000-0000-0000-0000-0000000000e8', 'wkg-eve@example.com', '{"full_name":"Eve"}');
update public.profiles set timezone = 'Europe/Rome', week_start = 1
 where id in ('00000000-0000-0000-0000-0000000000a8', '00000000-0000-0000-0000-0000000000b8', '00000000-0000-0000-0000-0000000000e8');

-- "Now" is Thursday 8 Oct 2026, 12:00 in Rome. This week: Mon 5 – Sun 11 Oct. Last week: 28 Sep – 4 Oct.
-- Family (Rome, Monday weeks) since 1 Sep with Anna and Dan; Eve joins on Wednesday 7 Oct at 09:00.
set local session_replication_role = replica;
insert into public.groups (id, name, kind, timezone, week_start, created_by, created_at)
values ('00000000-0000-0000-0000-0000000000f8', 'Family', 'family', 'Europe/Rome', 1, '00000000-0000-0000-0000-0000000000a8', '2026-09-01T08:00:00Z');
insert into public.group_members (group_id, user_id, role, joined_at) values
  ('00000000-0000-0000-0000-0000000000f8', '00000000-0000-0000-0000-0000000000a8', 'admin', '2026-09-01T08:00:00Z'),
  ('00000000-0000-0000-0000-0000000000f8', '00000000-0000-0000-0000-0000000000b8', 'member', '2026-09-01T09:00:00Z'),
  ('00000000-0000-0000-0000-0000000000f8', '00000000-0000-0000-0000-0000000000e8', 'member', '2026-10-07T07:00:00Z');
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, created_at, created_by) values
  ('00000000-0000-0000-0000-0000000008d1', null, '00000000-0000-0000-0000-0000000000f8', 'Dinner', 'people', '🍽️', 1, 'day', '2026-09-01', 1, '2026-09-01T08:00:00Z', '00000000-0000-0000-0000-0000000000a8'),
  ('00000000-0000-0000-0000-0000000008d2', null, '00000000-0000-0000-0000-0000000000f8', 'Game night', 'people', '🎲', 1, 'week', '2026-09-01', 1, '2026-09-01T08:00:00Z', '00000000-0000-0000-0000-0000000000a8'),
  ('00000000-0000-0000-0000-0000000008d3', '00000000-0000-0000-0000-0000000000a8', null, 'Walk', 'fitness', '🚶', 1, 'day', '2026-09-28', 1, '2026-09-28T08:00:00Z', '00000000-0000-0000-0000-0000000000a8'),
  -- Stretch (group, daily) started on Monday and ended on Tuesday.
  ('00000000-0000-0000-0000-0000000008d4', null, '00000000-0000-0000-0000-0000000000f8', 'Stretch', 'health', '🧘', 1, 'day', '2026-10-05', 1, '2026-10-04T08:00:00Z', '00000000-0000-0000-0000-0000000000a8');
update public.habits set ends_on = '2026-10-06' where id = '00000000-0000-0000-0000-0000000008d4';
set local session_replication_role = origin;

-- Dan is paused on Dinner on Wednesday.
insert into public.habit_freezes (habit_id, user_id, starts_on, ends_on)
values ('00000000-0000-0000-0000-0000000008d1', '00000000-0000-0000-0000-0000000000b8', '2026-10-07', '2026-10-07');

select private.check_in_impl(h, u, t)
  from (values
    -- Dinner: Anna Mon, Tue and today; Dan Mon only. Eve taps on Wednesday, the day she joined.
    ('00000000-0000-0000-0000-0000000008d1'::uuid, '00000000-0000-0000-0000-0000000000a8'::uuid, '2026-10-05T08:00:00Z'::timestamptz),
    ('00000000-0000-0000-0000-0000000008d1', '00000000-0000-0000-0000-0000000000a8', '2026-10-06T08:00:00Z'),
    ('00000000-0000-0000-0000-0000000008d1', '00000000-0000-0000-0000-0000000000a8', '2026-10-08T08:00:00Z'),
    ('00000000-0000-0000-0000-0000000008d1', '00000000-0000-0000-0000-0000000000b8', '2026-10-05T09:00:00Z'),
    ('00000000-0000-0000-0000-0000000008d1', '00000000-0000-0000-0000-0000000000e8', '2026-10-07T08:00:00Z'),
    -- Game night (weekly): Anna on Tuesday, Eve on Wednesday; Dan not yet.
    ('00000000-0000-0000-0000-0000000008d2', '00000000-0000-0000-0000-0000000000a8', '2026-10-06T18:00:00Z'),
    ('00000000-0000-0000-0000-0000000008d2', '00000000-0000-0000-0000-0000000000e8', '2026-10-07T18:00:00Z'),
    -- Walk (Anna's own): Monday only.
    ('00000000-0000-0000-0000-0000000008d3', '00000000-0000-0000-0000-0000000000a8', '2026-10-05T07:00:00Z'),
    -- Stretch: both of them, Monday and Tuesday (a 2-day group streak, then the end).
    ('00000000-0000-0000-0000-0000000008d4', '00000000-0000-0000-0000-0000000000a8', '2026-10-05T07:30:00Z'),
    ('00000000-0000-0000-0000-0000000008d4', '00000000-0000-0000-0000-0000000000b8', '2026-10-05T07:30:00Z'),
    ('00000000-0000-0000-0000-0000000008d4', '00000000-0000-0000-0000-0000000000a8', '2026-10-06T07:30:00Z'),
    ('00000000-0000-0000-0000-0000000008d4', '00000000-0000-0000-0000-0000000000b8', '2026-10-06T07:30:00Z')) as v(h, u, t);

create temp table ov as
  select u.id, private.week_overview_impl(u.id, '2026-10-08T10:00:00Z') as o
    from (values ('anna', '00000000-0000-0000-0000-0000000000a8'::uuid), ('dan', '00000000-0000-0000-0000-0000000000b8'::uuid),
                 ('eve', '00000000-0000-0000-0000-0000000000e8'::uuid)) as u(name, id);
create temp view anna as select o from ov where id = '00000000-0000-0000-0000-0000000000a8';
create temp view dan as select o from ov where id = '00000000-0000-0000-0000-0000000000b8';
create temp view eve as select o from ov where id = '00000000-0000-0000-0000-0000000000e8';

-- Anna. Dinner: Mon, Tue, Thu done, Wed missed (3/4); Game night done (1/1); Walk 1/3 (Thu open);
-- Stretch Mon and Tue done (2/2), nothing after its end.
select is((select row((o->>'done')::int, (o->>'possible')::int)::text from anna), '(7,10)',
  'group habits count: a daily one each day, a weekly one once, next to your own habits');
select is((select private.period_outcome(h, '2026-10-06') from public.habits h where h.id = '00000000-0000-0000-0000-0000000008d1'), 'missed',
  'setup: Dan didn''t do Tuesday''s Dinner, so the group''s Tuesday is missed');
select is((select c->>'status' from anna, jsonb_array_elements(o->'per_habit') p, jsonb_array_elements(p->'cells') c
            where p->>'habit_id' = '00000000-0000-0000-0000-0000000008d1' and c->>'period_start' = '2026-10-06'), 'done',
  'a group period is done for you when you did your part (the Today ring''s rule), whatever the others did');
-- Last week: Dinner 0/7, Game night 0/1, Walk 0/6 (its partial first day isn't a miss).
select is((select row((o->>'prev_done')::int, (o->>'prev_possible')::int)::text from anna), '(0,14)', 'last week counts group habits too');
select is((select array_agg((d->>'daily_done') || '/' || (d->>'daily_possible') order by d->>'local_date') from anna, jsonb_array_elements(o->'days') d),
  array['3/3', '2/3', '0/2', '1/2', '0/0', '0/0', '0/0'], 'the day circles count daily group habits, so today''s to-do one adds to the line');
select is((select (o->>'check_ins')::int from anna), 7, 'your own check-ins on group habits count');
select is((select (o->>'active_habits')::int from anna), 3, 'group habits are active habits, but not once their end has passed');
select is((select row((o->>'best_current_streak')::int, o->>'best_current_streak_title')::text from anna), '(2,Stretch)',
  'the best current streak includes group streaks, the same 🔥 the group habit shows');
select is((select array_agg(c->>'status' order by c->>'period_start') from anna, jsonb_array_elements(o->'per_habit') p, jsonb_array_elements(p->'cells') c
            where p->>'habit_id' = '00000000-0000-0000-0000-0000000008d1'),
  array['missed', 'missed', 'missed', 'done', 'done', 'missed', 'done'], 'a group habit''s dots are yours');

-- Dan: paused on Dinner on Wednesday, so Wednesday isn't counted. Dinner Mon done, Tue missed;
-- Stretch Mon and Tue done; Thu and the week are open.
select is((select row((o->>'done')::int, (o->>'possible')::int)::text from dan), '(3,4)', 'a paused member''s day isn''t counted');
select is((select array_agg((d->>'daily_done') || '/' || (d->>'daily_possible') order by d->>'local_date') from dan, jsonb_array_elements(o->'days') d),
  array['2/2', '1/2', '0/0', '0/1', '0/0', '0/0', '0/0'], 'the paused day is empty in the day circles');
select is((select array_agg(c->>'status' order by c->>'period_start') from dan, jsonb_array_elements(o->'per_habit') p, jsonb_array_elements(p->'cells') c
            where p->>'habit_id' = '00000000-0000-0000-0000-0000000008d1'),
  array['missed', 'missed', 'missed', 'done', 'missed', 'paused', 'open'], 'the paused day reads paused');

-- Eve joined on Wednesday: not required on Wednesday's Dinner or this week's Game night, though she tapped both.
select is((select row((o->>'done')::int, (o->>'possible')::int)::text from eve), '(0,0)',
  'a member who joined mid-period isn''t counted for it, even after a check-in');
select is((select (o->>'check_ins')::int from eve), 0, 'check-ins in periods you weren''t required in don''t count either');
select is((select array_agg((d->>'daily_done') || '/' || (d->>'daily_possible') order by d->>'local_date') from eve, jsonb_array_elements(o->'days') d),
  array['0/0', '0/0', '0/0', '0/1', '0/0', '0/0', '0/0'], 'from the next day on, the new member''s days count');
select is((select array_agg(c->>'status' order by c->>'period_start') from eve, jsonb_array_elements(o->'per_habit') p, jsonb_array_elements(p->'cells') c
            where p->>'habit_id' = '00000000-0000-0000-0000-0000000008d1'),
  array['not_started', 'not_started', 'not_started', 'not_started', 'not_started', 'not_started', 'open'],
  'before you joined, a group habit''s dots read not started');

select * from finish();
rollback;
