begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

-- Habits remember the template they came from (task 8.5): backfill by English title, cleared on
-- rename, stored by the create paths, returned by the reads.
select tests.create_user('00000000-0000-0000-0000-0000000085a1', 'tpl-anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000085b1', 'tpl-ben@example.com', '{"full_name":"Ben"}');
create temp table t (k text primary key, v uuid) on commit drop;
grant all on t to authenticated;
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000085a1', 'Family', 'family')).id;
select private.accept_invite_impl('00000000-0000-0000-0000-0000000085b1',
  (private.create_invite_impl('00000000-0000-0000-0000-0000000085a1', (select v from t where k='fam'), now())).token, now());
insert into t select 'kid', private.create_child_impl('00000000-0000-0000-0000-0000000085a1', (select v from t where k='fam'), 'Mia', '🐱', 'sky', true);

select has_column('public', 'habits', 'template_id', 'habits.template_id exists');

-- Old habits, made without a template (as before this migration).
create function pg_temp.own(p_title text) returns uuid language sql as $$
  insert into public.habits (owner_id, title, category, target_count, period)
  values ('00000000-0000-0000-0000-0000000085a1', p_title, 'health', 1, 'day') returning id;
$$;
insert into t values
  ('water', pg_temp.own('Drink water')),
  ('date', pg_temp.own('Date night')),
  ('family_dinner', pg_temp.own('Family dinner')),
  ('own', pg_temp.own('My own thing')),
  ('case', pg_temp.own('drink water')),
  ('kidonly', pg_temp.own('Tidy my toys'));
insert into t select 'g_date', (private.create_group_habit_impl('00000000-0000-0000-0000-0000000085a1', (select v from t where k='fam'),
  'Date night', '🕯️', 'people', 1, 'week', null, false, '{}', now())).id;
insert into t select 'g_read', (private.create_group_habit_impl('00000000-0000-0000-0000-0000000085a1', (select v from t where k='fam'),
  'Read 20 min', '📚', 'learning', 1, 'day', null, false, '{}', now())).id;
insert into t select 'k_water', (private.create_child_habit_impl('00000000-0000-0000-0000-0000000085a1', (select v from t where k='kid'),
  'Drink water', '💧', 1, 'day', null)).id;
insert into t select 'k_plants', (private.create_child_habit_impl('00000000-0000-0000-0000-0000000085a1', (select v from t where k='kid'),
  'Water the plants', '🌱', 1, 'week', null)).id;
insert into t select 'k_adult', (private.create_child_habit_impl('00000000-0000-0000-0000-0000000085a1', (select v from t where k='kid'),
  'Read 20 min', '📚', 1, 'day', null)).id;
insert into t select 'k_set', (private.create_child_habit_impl('00000000-0000-0000-0000-0000000085a1', (select v from t where k='kid'),
  'Bath time', '🛁', 1, 'day', null, 'kid.bath')).id;

create function pg_temp.tpl(p_key text) returns text language sql as $$
  select h.template_id from public.habits h where h.id = (select v from t where k = p_key);
$$;

select is(private.backfill_habit_template_ids(), 7, 'backfill: 7 habits match an English template title');
select is(pg_temp.tpl('water'), 'water', 'backfill: adult Drink water → water (not kid.water)');
select is(pg_temp.tpl('date'), 'date-night', 'backfill: personal Date night → date-night');
select is(pg_temp.tpl('g_date'), 'g-date-night', 'backfill: group Date night → g-date-night');
select is(pg_temp.tpl('family_dinner'), 'g-family-dinner', 'backfill: a title only one template has → that template');
select is(pg_temp.tpl('g_read'), 'read', 'backfill: an adult template on a group habit');
select is(pg_temp.tpl('k_water'), 'kid.water', 'backfill: kid Drink water → kid.water');
select is(pg_temp.tpl('k_plants'), 'kid.plants', 'backfill: kid Water the plants → kid.plants');
select is(pg_temp.tpl('own'), null, 'backfill: a hand-typed title stays null');
select is(pg_temp.tpl('case'), null, 'backfill: case-sensitive');
select is(pg_temp.tpl('kidonly'), null, 'backfill: an adult habit never gets a kid template');
select is(pg_temp.tpl('k_adult'), null, 'backfill: a kid habit never gets an adult template');
select is(pg_temp.tpl('k_set'), 'kid.bath', 'backfill: an id already set is kept');

-- Rename clears; a rename that sets the template too keeps it; other edits keep it.
update public.habits set title = 'Drink more water' where id = (select v from t where k='water');
select is(pg_temp.tpl('water'), null, 'rename clears the template');
update public.habits set title = 'Date night', template_id = 'date-night' where id = (select v from t where k='own');
select is(pg_temp.tpl('own'), 'date-night', 'title + template in one update keeps the new template');
update public.habits set category = 'people' where id = (select v from t where k='date');
select is(pg_temp.tpl('date'), 'date-night', 'another edit keeps the template');
update public.habits set title = 'Date night' where id = (select v from t where k='date');
select is(pg_temp.tpl('date'), 'date-night', 'the same title keeps the template');

select throws_ok($$update public.habits set template_id = 'Bad id' where id = (select v from t where k='date')$$,
  '23514', null, 'a malformed id is refused');

-- Create paths store it.
select tests.authenticate_as('00000000-0000-0000-0000-0000000085a1');
insert into t select 'rpc_group', (public.create_group_habit((select v from t where k='fam'), 'Game night', '🎲', 'people', 1::smallint,
  'week', p_requires_approval => true, p_template_id => 'g-game-night')).id;
insert into t select 'rpc_kid', (public.create_child_habit((select v from t where k='kid'), 'Make my bed', '🛏️', 1::smallint, 'day',
  p_template_id => 'kid.make-bed')).id;
insert into t select 'rpc_plain', (public.create_child_habit((select v from t where k='kid'), 'Feed the fish', '🐟', 1::smallint, 'day')).id;
insert into public.habits (title, category, target_count, period, template_id) values ('Run', 'fitness', 1, 'day', 'run');
reset role;
select is(pg_temp.tpl('rpc_group'), 'g-game-night', 'create_group_habit stores the template');
select is(pg_temp.tpl('rpc_kid'), 'kid.make-bed', 'create_child_habit stores the template');
select is(pg_temp.tpl('rpc_plain'), null, 'no template passed → null');
select is((select template_id from public.habits where owner_id = '00000000-0000-0000-0000-0000000085a1' and title = 'Run'), 'run',
  'the app''s own insert may set the template');
select tests.authenticate_as('00000000-0000-0000-0000-0000000085a1');
update public.habits set title = 'Run far' where title = 'Run';
reset role;
select is((select template_id from public.habits where owner_id = '00000000-0000-0000-0000-0000000085a1' and title = 'Run far'), null,
  'the app''s own rename clears the template');

-- Reads.
select tests.authenticate_as('00000000-0000-0000-0000-0000000085a1');
select is((select s.template_id from public.habit_summaries() s where s.habit_id = (select v from t where k='rpc_group')), 'g-game-night',
  'habit_summaries returns template_id');
select is((select s.template_id from public.child_summaries((select v from t where k='kid')) s where s.habit_id = (select v from t where k='rpc_kid')),
  'kid.make-bed', 'child_summaries returns template_id');
reset role;

-- Ben checks in to the approval habit: Anna is asked to approve.
insert into t select 'ben_ci', (private.check_in_impl((select v from t where k='rpc_group'), '00000000-0000-0000-0000-0000000085b1', now())).id;
select is((select p.habit_template from private.pending_approvals_impl('00000000-0000-0000-0000-0000000085a1', now()) p
            where p.check_in_id = (select v from t where k='ben_ci')), 'g-game-night', 'pending_approvals returns habit_template');
select is((select f.habit_template from private.inbox_feed_impl('00000000-0000-0000-0000-0000000085a1', 50) f
            where f.check_in_id = (select v from t where k='ben_ci') and f.kind = 'approval_needed'), 'g-game-night', 'inbox_feed returns habit_template');

update public.notifications set push = true
 where user_id = '00000000-0000-0000-0000-0000000085a1' and kind = 'approval_needed' and check_in_id = (select v from t where k='ben_ci');
select is(private.push_job_build((select id from public.notifications
                                   where user_id = '00000000-0000-0000-0000-0000000085a1' and kind = 'approval_needed'
                                     and check_in_id = (select v from t where k='ben_ci'))) ->> 'habit_template',
  'g-game-night', 'push_job_build returns habit_template');
select is(private.push_job_build((select id from public.notifications
                                   where user_id = '00000000-0000-0000-0000-0000000085a1' and kind = 'approval_needed'
                                     and check_in_id = (select v from t where k='ben_ci'))) -> 'pending' -> 0 ->> 'habit_template',
  'g-game-night', 'push_job_build pending items carry habit_template');

-- Progress: the best current streak's template sits next to its title (null without a streak).
select ok('best_template' = any ((select p.proargnames from pg_proc p where p.oid = 'public.family_recaps()'::regprocedure)::text[]),
  'family_recaps returns best_template');
select ok(private.week_overview_impl('00000000-0000-0000-0000-0000000085a1', now()) ? 'best_current_streak_template',
  'week_overview has best_current_streak_template');

-- The demo's template habits carry their template; the others stay null.
select tests.create_anonymous_user('00000000-0000-0000-0000-0000000085c1');
select tests.authenticate_as('00000000-0000-0000-0000-0000000085c1');
select public.start_demo('Europe/Berlin');
reset role;
select is((select string_agg(h.title || '=' || coalesce(h.template_id, '-'), ', ' order by h.title)
             from public.habits h
            where h.owner_id = '00000000-0000-0000-0000-0000000085c1'
               or h.group_id = (select p.group_id from public.profiles p where p.kind = 'child'
                                  and p.group_id in (select m.group_id from public.group_members m where m.user_id = '00000000-0000-0000-0000-0000000085c1'))
               or h.owner_id in (select p.id from public.profiles p where p.kind = 'child'
                                  and p.group_id in (select m.group_id from public.group_members m where m.user_id = '00000000-0000-0000-0000-0000000085c1'))),
  'Brush teeth=kid.brush-teeth, Drink water=water, Family dinner=g-family-dinner, Meditate=meditate, Read=-, Read a story=-, Tidy toys=-, Walk=-, Walk together=-',
  'demo: template habits carry their template');

-- Recaps (live, public.recaps → recap_impl): Sam's last week names Family dinner's template.
select is((select e ->> 'template'
             from jsonb_array_elements(private.recap_impl('00000000-0000-0000-0000-0000000085c1', 'week',
                    private.period_start('week', private.local_date(now(), 'Europe/Berlin'), 1::smallint) - 7, now()) -> 'top') e
            where e ->> 'title' = 'Family dinner'), 'g-family-dinner', 'recap top items carry the template');
select ok(private.recap_impl('00000000-0000-0000-0000-0000000085c1', 'week',
            private.period_start('week', private.local_date(now(), 'Europe/Berlin'), 1::smallint) - 7, now()) -> 'longest' ? 'template',
  'recap longest carries the template key');

-- The daily summary's items carry the template.
update public.profiles set timezone = 'UTC', reminder_hour = extract(hour from now() at time zone 'UTC')::int
 where id = '00000000-0000-0000-0000-0000000085a1';
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
values ('00000000-0000-0000-0000-0000000085a1', 'https://push.example.com/tpl-anna', 'p256dh', 'auth');
select private.enqueue_reminders(now());
select is((select string_agg(distinct e ->> 'template', ',')
             from public.notifications n cross join jsonb_array_elements(n.payload -> 'todo') e
            where n.user_id = '00000000-0000-0000-0000-0000000085a1' and n.kind = 'daily_summary' and e ->> 'title' = 'Date night'),
  'date-night', 'daily summary todo items carry the template');

select * from finish();
rollback;
