-- supabase/tests/database/badges.test.sql
-- One assertion per badge (spec: every rule has a test), plus the wiring, quiet, RLS and setting.
begin;
create extension if not exists pgtap with schema extensions;
select plan(57);

select tests.create_user(id::uuid, n || '@example.com', jsonb_build_object('full_name', n))
  from (values ('00000000-0000-0000-0000-0000000000a1', 'Anna'), ('00000000-0000-0000-0000-0000000000b1', 'Dan'),
               ('00000000-0000-0000-0000-0000000000e1', 'Eve'), ('00000000-0000-0000-0000-0000000000c1', 'Cleo'),
               ('00000000-0000-0000-0000-0000000000a2', 'Pia'), ('00000000-0000-0000-0000-0000000000a3', 'Paul'),
               ('00000000-0000-0000-0000-0000000000a4', 'Wes'), ('00000000-0000-0000-0000-0000000000a5', 'Mo'),
               ('00000000-0000-0000-0000-0000000000a6', 'Gus'), ('00000000-0000-0000-0000-0000000000f1', 'Fay')) v(id, n);
update public.profiles set timezone = 'Europe/Rome' where id = '00000000-0000-0000-0000-0000000000a1';
create temp table t (k text primary key, v uuid) on commit drop;

-- Helpers: a habit, and n settled done periods with their period XP (triggers off), so each rule is
-- tested on exactly the history it reads.
create function pg_temp.habit(p_id uuid, p_owner uuid, p_category public.habit_category, p_period public.habit_period, p_target int, p_starts date, p_group uuid default null)
returns void language sql as $$
  insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, created_at, created_by)
  values (p_id, case when p_group is null then p_owner end, p_group, 'H', p_category, '⭐', p_target, p_period, p_starts, 1, p_starts::timestamptz, p_owner);
$$;
create function pg_temp.seed(p_habit uuid, p_user uuid, p_from date, p_n int, p_step interval default '1 day')
returns void language sql as $$
  insert into public.period_results (habit_id, period_start, outcome, finalized_at)
  select p_habit, (p_from + p_step * i)::date, 'done', p_from + p_step * (i + 1) from generate_series(0, p_n - 1) i;
  insert into public.xp_events (user_id, amount, reason, source_type, source_id, habit_id, created_at)
  select p_user, 20, 'period_done', 'period', p_habit || ':' || (p_from + p_step * i)::date, p_habit, p_from + p_step * (i + 1)
    from generate_series(0, p_n - 1) i;
$$;
create function pg_temp.has(p_user uuid, p_code text) returns boolean language sql as $$
  select exists (select 1 from public.user_achievements where user_id = p_user and achievement_code = p_code);
$$;

-- Catalog
select is((select count(*)::int from public.achievements), 24, '24 badges');
select ok(exists (select 1 from public.achievements where code = 'go_getter' and name = 'Go-getter') and not exists (select 1 from public.achievements where code = 'saver'),
  'Go-getter replaces Saver');

-- Wiring through the real flows: Planted (habit insert), First step (check-in), Full day.
insert into public.habits (owner_id, title, category, target_count, period) values ('00000000-0000-0000-0000-0000000000a1', 'Read', 'learning', 1, 'day');
insert into public.habits (owner_id, title, category, target_count, period) values ('00000000-0000-0000-0000-0000000000a1', 'Walk', 'fitness', 1, 'day');
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000a1', 'planted'), 'Planted: the first habit');
select is((select payload ->> 'name' from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'badge_unlocked'), 'Planted',
  'one Inbox row names the badge');
select private.check_in_impl((select id from public.habits where owner_id = '00000000-0000-0000-0000-0000000000a1' and title = 'Read'), '00000000-0000-0000-0000-0000000000a1', now());
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000a1', 'first_step'), 'First step: the first counted check-in');
select ok(not pg_temp.has('00000000-0000-0000-0000-0000000000a1', 'full_day'), 'Full day: not with one of two done');
select private.check_in_impl((select id from public.habits where owner_id = '00000000-0000-0000-0000-0000000000a1' and title = 'Walk'), '00000000-0000-0000-0000-0000000000a1', now());
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000a1', 'full_day'), 'Full day: every habit due today done (2)');

-- Cheerleader: the 20th cheer, through the cheers trigger.
set local session_replication_role = replica;
select pg_temp.habit('00000000-0000-0000-0000-00000000c0c0', '00000000-0000-0000-0000-0000000000a1', 'mind', 'day', 1, '2026-01-01');
insert into public.check_ins (id, habit_id, user_id, local_date, period_start, status, created_at, logged_by)
select ('00000000-0000-0000-0000-0000000c' || lpad(i::text, 4, '0'))::uuid, '00000000-0000-0000-0000-00000000c0c0', '00000000-0000-0000-0000-0000000000a1',
       '2026-01-01'::date + i, '2026-01-01'::date + i, 'approved', '2026-01-01'::timestamptz + make_interval(days => i), '00000000-0000-0000-0000-0000000000a1'
  from generate_series(1, 20) i;
insert into public.cheers (check_in_id, user_id, created_at)
select ('00000000-0000-0000-0000-0000000c' || lpad(i::text, 4, '0'))::uuid, '00000000-0000-0000-0000-0000000000b1', '2026-02-01'::timestamptz + make_interval(mins => i)
  from generate_series(1, 19) i;
set local session_replication_role = origin;
insert into public.cheers (check_in_id, user_id, created_at) values ('00000000-0000-0000-0000-0000000c0020', '00000000-0000-0000-0000-0000000000b1', '2026-02-02');
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000b1', 'cheerleader'), 'Cheerleader: 20 cheers given');

-- Fair judge: 20 approvals given.
set local session_replication_role = replica;
insert into public.check_ins (habit_id, user_id, local_date, period_start, status, created_at, logged_by, reviewed_by, reviewed_at)
select '00000000-0000-0000-0000-00000000c0c0', '00000000-0000-0000-0000-0000000000b1', '2026-03-01'::date + i, '2026-03-01'::date + i, 'approved',
       '2026-03-01'::timestamptz + make_interval(days => i), '00000000-0000-0000-0000-0000000000b1',
       '00000000-0000-0000-0000-0000000000a1', '2026-03-01'::timestamptz + make_interval(days => i, hours => 1)
  from generate_series(1, 20) i;
set local session_replication_role = origin;
select private.badges_on_review(c) from public.check_ins c where c.reviewed_by = '00000000-0000-0000-0000-0000000000a1' order by c.reviewed_at desc limit 1;
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000a1', 'fair_judge'), 'Fair judge: 20 approvals given');

-- Kids earn badges behind the scenes, with no Inbox row.
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Family', 'family')).id;
insert into t select 'mary', private.create_child_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), 'Mary', '🐼', 'peach', true);
set local session_replication_role = replica;
insert into public.habits (id, owner_id, title, category, emoji, target_count, period, starts_on, week_start, created_at, created_by)
values ('00000000-0000-0000-0000-0000000000d3', (select v from t where k = 'mary'), 'Brush teeth', null, '🪥', 1, 'day', current_date - 2, 1, now() - interval '2 days', '00000000-0000-0000-0000-0000000000a1');
set local session_replication_role = origin;
select private.check_in_impl('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a1', now(), (select v from t where k = 'mary'));
select ok(pg_temp.has((select v from t where k = 'mary'), 'first_step'), 'a child earns First step behind the scenes');
select is((select count(*)::int from public.notifications where user_id = (select v from t where k = 'mary')), 0, 'with no Inbox row');

-- Streaks (Eve): 30 days, then 365 days on another habit.
set local session_replication_role = replica;
select pg_temp.habit('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e1', 'fitness', 'day', 1, '2026-01-01');
select pg_temp.seed('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e1', '2026-01-01', 30);
select pg_temp.habit('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000e1', 'fitness', 'day', 1, '2025-01-01');
select pg_temp.seed('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000e1', '2025-01-01', 365);
select pg_temp.habit('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000e1', 'break_habit', 'day', 1, '2026-03-01');
select pg_temp.seed('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000e1', '2026-03-01', 30);
select pg_temp.habit('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000e1', 'health', 'day', 8, '2026-05-01');
select pg_temp.seed('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000e1', '2026-05-01', 7);
select pg_temp.habit('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f1', 'health', 'day', 1, '2026-05-01');
select pg_temp.seed('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f1', '2026-05-01', 7);
set local session_replication_role = origin;
select private.badges_on_period(h, '2026-01-30', 'done', '2027-01-01') from public.habits h where h.id = '00000000-0000-0000-0000-0000000000e2';
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000e1', 'first_week'), 'First week: a 7-period streak');
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000e1', 'two_weeks_strong'), 'Two weeks strong: 14 days');
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000e1', 'unstoppable'), 'Unstoppable: 30 days');
select ok(not pg_temp.has('00000000-0000-0000-0000-0000000000e1', 'century'), 'not Century at 30');
select private.badges_on_period(h, '2025-04-10', 'done', '2027-01-01') from public.habits h where h.id = '00000000-0000-0000-0000-0000000000e3';
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000e1', 'century'), 'Century: 100 days (evaluated on day 100)');
select private.badges_on_period(h, '2025-12-31', 'done', '2027-01-01') from public.habits h where h.id = '00000000-0000-0000-0000-0000000000e3';
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000e1', 'year_round'), 'Year-round: 365 days');
select private.badges_on_period(h, '2026-03-30', 'done', '2027-01-01') from public.habits h where h.id = '00000000-0000-0000-0000-0000000000e4';
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000e1', 'free'), 'Free: 30 days on a Break a habit habit');
select private.badges_on_period(h, '2026-05-07', 'done', '2027-01-01') from public.habits h where h.id = '00000000-0000-0000-0000-0000000000e5';
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000e1', 'hydrated'), 'Hydrated: a Health habit of 8+ a day, 7 days in a row');
select private.badges_on_period(h, '2026-05-07', 'done', '2027-01-01') from public.habits h where h.id = '00000000-0000-0000-0000-0000000000f2';
select ok(not pg_temp.has('00000000-0000-0000-0000-0000000000f1', 'hydrated'), 'not Hydrated with a once-a-day Health habit');

-- Perfect week (Pia: two daily habits, a whole Monday-week done) and not (Paul: one day missed).
set local session_replication_role = replica;
select pg_temp.habit(('00000000-0000-0000-0000-0000000000b' || i)::uuid, '00000000-0000-0000-0000-0000000000a2', 'mind', 'day', 1, '2026-09-07') from generate_series(2, 3) i;
select pg_temp.seed(('00000000-0000-0000-0000-0000000000b' || i)::uuid, '00000000-0000-0000-0000-0000000000a2', '2026-09-07', 7) from generate_series(2, 3) i;
select pg_temp.habit(('00000000-0000-0000-0000-0000000000b' || i)::uuid, '00000000-0000-0000-0000-0000000000a3', 'mind', 'day', 1, '2026-09-07') from generate_series(4, 5) i;
select pg_temp.seed('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000a3', '2026-09-07', 7);
select pg_temp.seed('00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-0000000000a3', '2026-09-07', 3);
insert into public.period_results (habit_id, period_start, outcome) values ('00000000-0000-0000-0000-0000000000b5', '2026-09-10', 'missed');
select pg_temp.seed('00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-0000000000a3', '2026-09-11', 3);
set local session_replication_role = origin;
select private.badges_on_period(h, '2026-09-13', 'done', '2027-01-01') from public.habits h where h.id in ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b5');
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000a2', 'perfect_week'), 'Perfect week: every habit, every day of a week (2 habits)');
select ok(not pg_temp.has('00000000-0000-0000-0000-0000000000a3', 'perfect_week'), 'not with one day missed');

-- Steady month: a weekly habit's 4 weeks in October (Wes), a monthly habit 3 months in a row (Mo).
set local session_replication_role = replica;
select pg_temp.habit('00000000-0000-0000-0000-0000000000b6', '00000000-0000-0000-0000-0000000000a4', 'home', 'week', 1, '2026-10-05');
select pg_temp.seed('00000000-0000-0000-0000-0000000000b6', '00000000-0000-0000-0000-0000000000a4', '2026-10-05', 4, '7 days');
select pg_temp.habit('00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-0000000000a5', 'home', 'month', 1, '2026-07-01');
select pg_temp.seed('00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-0000000000a5', '2026-07-01', 3, '1 month');
set local session_replication_role = origin;
select private.badges_on_period(h, '2026-10-26', 'done', '2027-01-01') from public.habits h where h.id = '00000000-0000-0000-0000-0000000000b6';
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000a4', 'steady_month'), 'Steady month: 4 done weeks of a weekly habit in one month');
select private.badges_on_period(h, '2026-09-01', 'done', '2027-01-01') from public.habits h where h.id = '00000000-0000-0000-0000-0000000000b7';
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000a5', 'steady_month'), 'Steady month: a monthly habit 3 months in a row');

-- Categories (Cleo): done periods for Mind, Learning, People, Work & money; check-ins for Fitness and Home.
set local session_replication_role = replica;
select pg_temp.habit(x.id::uuid, '00000000-0000-0000-0000-0000000000c1', x.cat::public.habit_category, 'day', 1, '2026-01-01')
  from (values ('00000000-0000-0000-0000-0000000000c2', 'mind'), ('00000000-0000-0000-0000-0000000000c3', 'learning'),
               ('00000000-0000-0000-0000-0000000000c4', 'people'), ('00000000-0000-0000-0000-0000000000c5', 'work_money'),
               ('00000000-0000-0000-0000-0000000000c6', 'fitness'), ('00000000-0000-0000-0000-0000000000c7', 'home'),
               ('00000000-0000-0000-0000-0000000000c8', 'fitness')) x(id, cat);
select pg_temp.seed('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c1', '2026-01-01', 30);
select pg_temp.seed('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000c1', '2026-01-01', 30);
select pg_temp.seed('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000c1', '2026-01-01', 10);
select pg_temp.seed('00000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-0000000000c1', '2026-01-01', 6);
insert into public.check_ins (habit_id, user_id, local_date, period_start, status, created_at, logged_by)
select h, '00000000-0000-0000-0000-0000000000c1', '2026-01-01'::date + i, '2026-01-01'::date + i, 'approved',
       '2026-01-01'::timestamptz + make_interval(days => i), '00000000-0000-0000-0000-0000000000c1'
  from generate_series(0, 49) i, unnest(array['00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-0000000000c7']::uuid[]) h;
-- Back on track: 3 done, 1 missed, 7 done.
select pg_temp.seed('00000000-0000-0000-0000-0000000000c8', '00000000-0000-0000-0000-0000000000c1', '2026-06-01', 3);
insert into public.period_results (habit_id, period_start, outcome) values ('00000000-0000-0000-0000-0000000000c8', '2026-06-04', 'missed');
select pg_temp.seed('00000000-0000-0000-0000-0000000000c8', '00000000-0000-0000-0000-0000000000c1', '2026-06-05', 7);
set local session_replication_role = origin;
select private.badges_on_period(h, '2026-01-09', 'done', '2026-01-10') from public.habits h where h.id = '00000000-0000-0000-0000-0000000000c4';
select ok(not pg_temp.has('00000000-0000-0000-0000-0000000000c1', 'good_company'), 'not Good company at 9 done in People');
select private.badges_on_period(h, ('2026-01-01'::date + n - 1), 'done', '2027-01-01')
  from public.habits h join (values ('00000000-0000-0000-0000-0000000000c2'::uuid, 30), ('00000000-0000-0000-0000-0000000000c3', 30),
                                    ('00000000-0000-0000-0000-0000000000c4', 10), ('00000000-0000-0000-0000-0000000000c5', 6)) v(id, n) on v.id = h.id;
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000c1', 'calm_mind'), 'Calm mind: 30 done in Mind');
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000c1', 'bookworm'), 'Bookworm: 30 done in Learning');
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000c1', 'good_company'), 'Good company: 10 done in People');
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000c1', 'go_getter'), 'Go-getter: 6 done in Work & money');
select private.badges_on_check_in(c) from public.check_ins c
 where c.id in (select distinct on (x.habit_id) x.id from public.check_ins x
                 where x.user_id = '00000000-0000-0000-0000-0000000000c1' order by x.habit_id, x.created_at desc);
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000c1', 'mover'), 'Mover: 50 check-ins in Fitness');
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000c1', 'home_keeper'), 'Home keeper: 50 check-ins in Home');
select private.badges_on_period(h, '2026-06-11', 'done', '2027-01-01') from public.habits h where h.id = '00000000-0000-0000-0000-0000000000c8';
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000c1', 'back_on_track'), 'Back on track: 7 again after a streak ended');
select ok(not pg_temp.has('00000000-0000-0000-0000-0000000000e1', 'back_on_track'), 'not for a streak that never ended');

-- Rest well (PR 10 writes rested; the rule is here).
select private.badges_on_period(h, '2026-01-31', 'rested', '2027-01-01') from public.habits h where h.id = '00000000-0000-0000-0000-0000000000e2';
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000e1', 'rest_well'), 'Rest well: the first rest day used');

-- Family: All together (first done group period), Team player (10).
insert into t select 'crew', (private.create_group_impl('00000000-0000-0000-0000-0000000000a6', 'Crew', 'friends')).id;
set local session_replication_role = replica;
select pg_temp.habit('00000000-0000-0000-0000-0000000000b8', '00000000-0000-0000-0000-0000000000a6', 'fitness', 'day', 1, '2026-02-01', (select v from t where k = 'crew'));
select pg_temp.seed('00000000-0000-0000-0000-0000000000b8', '00000000-0000-0000-0000-0000000000a6', '2026-02-01', 10);
set local session_replication_role = origin;
select private.badges_on_period(h, '2026-02-01', 'done', '2026-02-02') from public.habits h where h.id = '00000000-0000-0000-0000-0000000000b8';
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000a6', 'all_together') and not pg_temp.has('00000000-0000-0000-0000-0000000000a6', 'team_player'),
  'All together: the first done group period (not yet Team player)');
select private.badges_on_period(h, '2026-02-10', 'done', '2027-01-01') from public.habits h where h.id = '00000000-0000-0000-0000-0000000000b8';
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000a6', 'team_player'), 'Team player: 10 done group periods');

-- Quiet awards, privacy, the setting.
select private.award_badge('00000000-0000-0000-0000-0000000000f1', 'planted', '2026-01-01', true);
select ok((select seen_at is not null from public.user_achievements where user_id = '00000000-0000-0000-0000-0000000000f1' and achievement_code = 'planted')
          and not exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000f1' and kind = 'badge_unlocked'
                           and payload ->> 'code' = 'planted'),
  'a quiet award is marked seen and writes no Inbox row');
select tests.authenticate_as('00000000-0000-0000-0000-0000000000f1');
select is((select count(*)::int from public.user_achievements where user_id <> '00000000-0000-0000-0000-0000000000f1'), 0, 'Fay reads only her own badges');
select is((select count(*)::int from public.achievements), 24, 'and the whole catalog');
select throws_ok($$select public.set_celebrations('loud')$$, 'P0001', 'keepup:invalid_choice', 'Celebrations: Full or Subtle only');
select public.set_celebrations('subtle');
select is((select celebrations from public.profiles where id = '00000000-0000-0000-0000-0000000000f1'), 'subtle', 'Subtle is saved');
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1');
select is(public.mark_badges_seen(array['planted', 'first_step']), 2, 'mark_badges_seen marks the shown ones');
reset role;

-- Locks (addendum): the reward triggers queue their badges, and sync_deferred_levels writes them once,
-- per person in user id order, after the last habit lock. Kim and Lou each have 6 done days; their
-- 7th is checked in, and one finalize settles both (Lou's habit first, by habit id).
select tests.create_user(id::uuid, n || '@example.com', jsonb_build_object('full_name', n))
  from (values ('00000000-0000-0000-0000-0000000000d7', 'Kim'), ('00000000-0000-0000-0000-0000000000d8', 'Lou'),
               ('00000000-0000-0000-0000-0000000000d9', 'Nia')) v(id, n);
update public.profiles set timezone = 'UTC'
 where id in ('00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000d9');
set local session_replication_role = replica;
select pg_temp.habit('00000000-0000-0000-0000-0000000001d8', '00000000-0000-0000-0000-0000000000d8', 'fitness', 'day', 1, '2024-06-01');
select pg_temp.habit('00000000-0000-0000-0000-0000000002d7', '00000000-0000-0000-0000-0000000000d7', 'fitness', 'day', 1, '2024-06-01');
select pg_temp.seed('00000000-0000-0000-0000-0000000001d8', '00000000-0000-0000-0000-0000000000d8', '2024-06-01', 6);
select pg_temp.seed('00000000-0000-0000-0000-0000000002d7', '00000000-0000-0000-0000-0000000000d7', '2024-06-01', 6);
set local session_replication_role = origin;
select private.check_in_impl('00000000-0000-0000-0000-0000000001d8', '00000000-0000-0000-0000-0000000000d8', '2024-06-07 12:00+00');
select private.check_in_impl('00000000-0000-0000-0000-0000000002d7', '00000000-0000-0000-0000-0000000000d7', '2024-06-07 12:00+00');
create temp table badge_log (n serial, user_id uuid) on commit drop;
create function pg_temp.badge_trap() returns trigger language plpgsql as $$
begin
  if current_setting('keepup.defer_levels', true) = 'on' then
    raise exception 'user_achievements written inside the finalize loop';
  end if;
  insert into badge_log (user_id) values (new.user_id);
  return new;
end;
$$;
create trigger badge_trap before insert on public.user_achievements for each row execute function pg_temp.badge_trap();
select lives_ok($$select private.finalize_periods('2024-06-08 12:00+00')$$, 'finalize writes no badge inside its habit loop');
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000d7', 'first_week') and pg_temp.has('00000000-0000-0000-0000-0000000000d8', 'first_week'),
  'and both get First week after it');
select is((select array_agg(user_id order by n) from badge_log),
  array['00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000d8']::uuid[],
  'written in user id order (not habit order)');
drop trigger badge_trap on public.user_achievements;

-- A late tap that upgrades a missed 7th day: First week through the UPDATE, and both badges say late.
set local session_replication_role = replica;
select pg_temp.habit('00000000-0000-0000-0000-0000000003d9', '00000000-0000-0000-0000-0000000000d9', 'fitness', 'day', 1, '2024-07-01');
select pg_temp.seed('00000000-0000-0000-0000-0000000003d9', '00000000-0000-0000-0000-0000000000d9', '2024-07-01', 6);
insert into public.period_results (habit_id, period_start, outcome, finalized_at) values ('00000000-0000-0000-0000-0000000003d9', '2024-07-07', 'missed', '2024-07-08 00:30+00');
set local session_replication_role = origin;
select private.check_in_impl('00000000-0000-0000-0000-0000000003d9', '00000000-0000-0000-0000-0000000000d9', '2024-07-08 09:00+00', null, false, null, '2024-07-07 20:00+00');
select is((select array_agg((payload ->> 'code') || ':' || (payload ->> 'late') order by payload ->> 'code') from public.notifications
            where user_id = '00000000-0000-0000-0000-0000000000d9' and kind = 'badge_unlocked'),
  array['first_step:true', 'first_week:true'], 'a late upgrade awards First week, and its rows carry late');

-- Undo never takes a badge back.
delete from public.check_ins where user_id = '00000000-0000-0000-0000-0000000000d9';
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000d9', 'first_step') and pg_temp.has('00000000-0000-0000-0000-0000000000d9', 'first_week'),
  'an undone check-in keeps its badges');

-- Fix round 1 (owner 2026-10-06): Perfect week judges each person's OWN part of a group habit. Oli,
-- Rae, Sol and Tia share two daily group habits for the week of Mon 1 June. G1's last day settles
-- missed (Rae didn't), the only call: Oli's own part is done every day, so the missed settle gives
-- it to Oli and judges Rae (no badge). Sol was paused on G1 one day (left out); Tia was paused on G1
-- all week, so only G2 counts for her (a paused period is not done).
select tests.create_user(id::uuid, n || '@example.com', jsonb_build_object('full_name', n))
  from (values ('00000000-0000-0000-0000-0000000000a7', 'Oli'), ('00000000-0000-0000-0000-0000000000a8', 'Rae'),
               ('00000000-0000-0000-0000-0000000000a9', 'Sol'), ('00000000-0000-0000-0000-0000000000aa', 'Tia'),
               ('00000000-0000-0000-0000-0000000000ab', 'Uma')) v(id, n);
update public.profiles set timezone = 'UTC'
 where id in ('00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000a8', '00000000-0000-0000-0000-0000000000a9',
              '00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-0000000000ab');
insert into t select 'duo', (private.create_group_impl('00000000-0000-0000-0000-0000000000a7', 'Crew 2', 'friends')).id;
insert into public.group_members (group_id, user_id)
select (select v from t where k = 'duo'), m.id::uuid
  from (values ('00000000-0000-0000-0000-0000000000a8'), ('00000000-0000-0000-0000-0000000000a9'), ('00000000-0000-0000-0000-0000000000aa')) m(id);
update public.group_members set joined_at = '2026-05-01' where group_id = (select v from t where k = 'duo');
update public.groups set timezone = 'UTC' where id = (select v from t where k = 'duo');
set local session_replication_role = replica;
select pg_temp.habit(('00000000-0000-0000-0000-00000000040' || i)::uuid, '00000000-0000-0000-0000-0000000000a7', 'mind', 'day', 1, '2026-06-01', (select v from t where k = 'duo'))
  from generate_series(1, 2) i;
insert into public.period_results (habit_id, period_start, outcome, finalized_at)
select ('00000000-0000-0000-0000-00000000040' || h)::uuid, '2026-06-01'::date + d, case when h = 1 and d = 6 then 'missed' else 'done' end,
       '2026-06-02'::timestamptz + make_interval(days => d)
  from generate_series(1, 2) h, generate_series(0, 6) d;
insert into public.habit_freezes (habit_id, user_id, starts_on, ends_on, created_by) values
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-0000000000a9', '2026-06-03', '2026-06-03', '00000000-0000-0000-0000-0000000000a9'),
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-0000000000aa', '2026-06-01', '2026-06-07', '00000000-0000-0000-0000-0000000000aa');
insert into public.check_ins (habit_id, user_id, local_date, period_start, status, created_at, logged_by)
select ('00000000-0000-0000-0000-00000000040' || h)::uuid, u::uuid, '2026-06-01'::date + d, '2026-06-01'::date + d, 'approved',
       '2026-06-01 09:00+00'::timestamptz + make_interval(days => d), u::uuid
  from generate_series(1, 2) h, generate_series(0, 6) d,
       unnest(array['00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000a8',
                    '00000000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-0000000000aa']) u
 where not (h = 1 and d = 6 and u = '00000000-0000-0000-0000-0000000000a8')
   and not (h = 1 and d = 2 and u = '00000000-0000-0000-0000-0000000000a9')
   and not (h = 1 and u = '00000000-0000-0000-0000-0000000000aa');
set local session_replication_role = origin;
select private.badges_on_period(h, '2026-06-07', 'missed', '2026-06-08 12:00+00') from public.habits h where h.id = '00000000-0000-0000-0000-000000000401';
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000a7', 'perfect_week'),
  'Perfect week: my own part done every day, though another member missed a day (judged on the missed settle)');
select ok(not pg_temp.has('00000000-0000-0000-0000-0000000000a8', 'perfect_week'), 'not when I missed one group day (still judged when it settles missed)');
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000a9', 'perfect_week'), 'a day I was paused doesn''t break it');
select private.badges_on_period(h, '2026-06-07', 'done', '2026-06-08 12:00+00') from public.habits h where h.id = '00000000-0000-0000-0000-000000000402';
select ok(not pg_temp.has('00000000-0000-0000-0000-0000000000aa', 'perfect_week'), 'and a paused period doesn''t count as done (one habit left)');

-- Fair judge through the real review: Oli has approved 19; the 20th is review_check_in_impl.
set local session_replication_role = replica;
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, requires_approval, created_at, created_by)
values ('00000000-0000-0000-0000-000000000403', null, (select v from t where k = 'duo'), 'Gym', 'fitness', '🏋️', 1, 'day', '2026-07-01', 1, true,
        '2026-07-01', '00000000-0000-0000-0000-0000000000a7');
insert into public.check_ins (habit_id, user_id, local_date, period_start, status, created_at, logged_by, reviewed_by, reviewed_at)
select '00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-0000000000a8', '2026-07-01'::date + i, '2026-07-01'::date + i, 'approved',
       '2026-07-01 09:00+00'::timestamptz + make_interval(days => i), '00000000-0000-0000-0000-0000000000a8',
       '00000000-0000-0000-0000-0000000000a7', '2026-07-01 10:00+00'::timestamptz + make_interval(days => i)
  from generate_series(0, 18) i;
set local session_replication_role = origin;
insert into t select 'g20', (private.check_in_impl('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-0000000000a8', '2026-08-20 09:00+00')).id;
select private.review_check_in_impl((select v from t where k = 'g20'), '00000000-0000-0000-0000-0000000000a7', true, '2026-08-20 10:00+00');
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000a7', 'fair_judge'), 'Fair judge: the 20th approval, through review_check_in_impl');

-- Back on track needs a streak that ended: a miss with nothing done before it isn't one.
set local session_replication_role = replica;
select pg_temp.habit('00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-0000000000aa', 'fitness', 'day', 1, '2026-04-01');
insert into public.period_results (habit_id, period_start, outcome, finalized_at) values ('00000000-0000-0000-0000-000000000404', '2026-04-01', 'missed', '2026-04-02');
select pg_temp.seed('00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-0000000000aa', '2026-04-02', 7);
set local session_replication_role = origin;
select private.badges_on_period(h, '2026-04-08', 'done', '2027-01-01') from public.habits h where h.id = '00000000-0000-0000-0000-000000000404';
select ok(pg_temp.has('00000000-0000-0000-0000-0000000000aa', 'first_week') and not pg_temp.has('00000000-0000-0000-0000-0000000000aa', 'back_on_track'),
  'not Back on track after a miss with nothing done before it');

-- Backfill dating: Uma reached 7 on two habits; the one with the higher id got there first (8 Mar).
set local session_replication_role = replica;
select pg_temp.habit('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000000ab', 'fitness', 'day', 1, '2024-03-10');
select pg_temp.habit('00000000-0000-0000-0000-0000000005b1', '00000000-0000-0000-0000-0000000000ab', 'fitness', 'day', 1, '2024-03-01');
select pg_temp.seed('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000000ab', '2024-03-10', 7);
select pg_temp.seed('00000000-0000-0000-0000-0000000005b1', '00000000-0000-0000-0000-0000000000ab', '2024-03-01', 7);
set local session_replication_role = origin;

-- Backfill is idempotent; reset clears a child's badges.
select private.backfill_badges();
select is((select unlocked_at from public.user_achievements where user_id = '00000000-0000-0000-0000-0000000000ab' and achievement_code = 'first_week'),
  ('2024-03-01'::date + interval '7 days')::timestamptz, 'the backfill dates a badge at the earlier of two habits');
select ok((select bool_and(seen_at is not null) and count(*) >= 2 from public.user_achievements where user_id = '00000000-0000-0000-0000-0000000000ab')
          and not exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000ab'),
  'and quietly: marked seen, no Inbox rows');
select is(private.backfill_badges(), 0, 'a second backfill awards nothing');
select private.reset_child_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'mary'));
select is((select count(*)::int from public.user_achievements where user_id = (select v from t where k = 'mary')), 0, 'reset clears the child''s badges');

select * from finish();
rollback;
