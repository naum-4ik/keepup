-- supabase/tests/database/rest_days.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

delete from public.habits;
select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'bea@example.com', '{"full_name":"Bea"}');
select tests.create_user('00000000-0000-0000-0000-0000000000c1', 'cy@example.com', '{"full_name":"Cy"}');
select tests.create_user('00000000-0000-0000-0000-0000000000c2', 'wes@example.com', '{"full_name":"Wes"}');
update public.profiles set timezone = 'Europe/Rome'
 where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1',
              '00000000-0000-0000-0000-0000000000c2');
create temp table t (k text primary key, v uuid) on commit drop;
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Family', 'family')).id;
update public.group_members set joined_at = '2026-09-01' where group_id = (select v from t where k = 'fam');
insert into t select 'mary', private.create_child_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), 'Mary', '🐼', 'peach', true);

set local session_replication_role = replica;
insert into public.habits (id, owner_id, group_id, title, category, emoji, target_count, period, starts_on, week_start, requires_approval, created_at, created_by)
select x.id::uuid, case when x.grp then null else coalesce(x.owner, '00000000-0000-0000-0000-0000000000a1')::uuid end,
       case when x.grp then (select v from t where k = 'fam') end, x.title, x.cat::public.habit_category, '⭐', 1, x.period::public.habit_period,
       x.starts::date, 1, false, x.starts::timestamptz, '00000000-0000-0000-0000-0000000000a1'
  from (values ('00000000-0000-0000-0000-0000000000d1', 'Read', 'learning', 'day', '2026-10-01', false, null),
               ('00000000-0000-0000-0000-0000000000d2', 'Walk', 'fitness', 'day', '2026-10-01', false, null),
               ('00000000-0000-0000-0000-0000000000d3', 'Stretch', 'fitness', 'day', '2026-10-01', false, null),
               ('00000000-0000-0000-0000-0000000000d4', 'Yoga', 'mind', 'day', '2026-10-01', false, null),
               ('00000000-0000-0000-0000-0000000000d5', 'Gym', 'fitness', 'week', '2026-09-07', false, null),
               ('00000000-0000-0000-0000-0000000000d6', 'Dinner', 'people', 'day', '2026-10-01', true, null),
               ('00000000-0000-0000-0000-0000000000d7', 'Budget', 'work_money', 'month', '2026-07-01', false, null)) x(id, title, cat, period, starts, grp, owner);
insert into public.habits (id, owner_id, title, category, emoji, target_count, period, starts_on, week_start, created_at, created_by)
values ('00000000-0000-0000-0000-0000000000d8', (select v from t where k = 'mary'), 'Brush teeth', null, '🪥', 1, 'day', '2026-10-01', 1, '2026-10-01', '00000000-0000-0000-0000-0000000000a1');
-- Bea: three daily habits for Perfect week and Full day (a rested day counts like a paused one).
insert into public.habits (id, owner_id, title, category, emoji, target_count, period, starts_on, week_start, created_at, created_by)
select x.id::uuid, '00000000-0000-0000-0000-0000000000b1', x.title, 'home', '⭐', 1, 'day', '2026-09-21', 1, '2026-09-21', '00000000-0000-0000-0000-0000000000b1'
  from (values ('00000000-0000-0000-0000-0000000000e1', 'Tidy'), ('00000000-0000-0000-0000-0000000000e2', 'Dishes'),
               ('00000000-0000-0000-0000-0000000000e3', 'Plants')) x(id, title);
-- Cy: Tidy has 7 done days, then misses 28 Sep (rested); Dishes and Plants start that day, done. Cy never
-- has two daily habits all done at a check-in, so Full day can only come from the rested settle.
insert into public.habits (id, owner_id, title, category, emoji, target_count, period, starts_on, week_start, created_at, created_by)
select x.id::uuid, '00000000-0000-0000-0000-0000000000c1', x.title, 'home', '⭐', 1, 'day', x.starts::date, 1, x.starts::timestamptz,
       '00000000-0000-0000-0000-0000000000c1'
  from (values ('00000000-0000-0000-0000-0000000000f1', 'Tidy', '2026-09-21'), ('00000000-0000-0000-0000-0000000000f2', 'Dishes', '2026-09-28'),
               ('00000000-0000-0000-0000-0000000000f3', 'Plants', '2026-09-28')) x(id, title, starts);
-- Wes: a weekly habit for Steady month (seeded results below).
insert into public.habits (id, owner_id, title, category, emoji, target_count, period, starts_on, week_start, created_at, created_by)
values ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000c2', 'Swim', 'fitness', '🏊', 1, 'week', '2026-10-05', 1,
        '2026-10-05', '00000000-0000-0000-0000-0000000000c2');
insert into public.habit_freezes (habit_id, starts_on, ends_on) values ('00000000-0000-0000-0000-0000000000d4', '2026-10-08', '2026-10-08');
set local session_replication_role = origin;

create function pg_temp.tap(p_habit uuid, p_from date, p_to date, p_subject uuid default null,
  p_actor uuid default '00000000-0000-0000-0000-0000000000a1') returns void language sql as $$
  select private.check_in_impl(p_habit, p_actor, (d::date + time '09:00') at time zone 'Europe/Rome', p_subject)
    from generate_series(p_from::timestamp, p_to::timestamp, '1 day') d;
$$;
select pg_temp.tap('00000000-0000-0000-0000-0000000000d1', '2026-10-01', '2026-10-07');
select pg_temp.tap('00000000-0000-0000-0000-0000000000d1', '2026-10-09', '2026-10-09');
select pg_temp.tap('00000000-0000-0000-0000-0000000000d2', '2026-10-01', '2026-10-21');
select pg_temp.tap('00000000-0000-0000-0000-0000000000d3', '2026-10-01', '2026-10-07');
select pg_temp.tap('00000000-0000-0000-0000-0000000000d4', '2026-10-01', '2026-10-07');
select pg_temp.tap('00000000-0000-0000-0000-0000000000d6', '2026-10-01', '2026-10-07');
select pg_temp.tap('00000000-0000-0000-0000-0000000000d8', '2026-10-01', '2026-10-07', (select v from t where k = 'mary'));
select private.check_in_impl('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000a1', d)
  from unnest(array['2026-09-08 09:00+02', '2026-09-15 09:00+02', '2026-09-22 09:00+02', '2026-09-29 09:00+02']::timestamptz[]) d;
select private.check_in_impl('00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000a1', d)
  from unnest(array['2026-07-10 09:00+02', '2026-08-10 09:00+02']::timestamptz[]) d;
-- Bea's week of Mon 28 Sep: Tidy rests on Monday (7 done before it), everything else is done.
select pg_temp.tap('00000000-0000-0000-0000-0000000000e1', '2026-09-21', '2026-09-27', null, '00000000-0000-0000-0000-0000000000b1');
select pg_temp.tap('00000000-0000-0000-0000-0000000000e1', '2026-09-29', '2026-10-04', null, '00000000-0000-0000-0000-0000000000b1');
select pg_temp.tap('00000000-0000-0000-0000-0000000000e2', '2026-09-28', '2026-10-04', null, '00000000-0000-0000-0000-0000000000b1');
select pg_temp.tap('00000000-0000-0000-0000-0000000000e3', '2026-09-28', '2026-10-04', null, '00000000-0000-0000-0000-0000000000b1');
select pg_temp.tap('00000000-0000-0000-0000-0000000000f1', '2026-09-21', '2026-09-27', null, '00000000-0000-0000-0000-0000000000c1');
select pg_temp.tap('00000000-0000-0000-0000-0000000000f2', '2026-09-28', '2026-09-28', null, '00000000-0000-0000-0000-0000000000c1');
select pg_temp.tap('00000000-0000-0000-0000-0000000000f3', '2026-09-28', '2026-09-28', null, '00000000-0000-0000-0000-0000000000c1');
select ok(not exists (select 1 from public.user_achievements where user_id = '00000000-0000-0000-0000-0000000000c1' and achievement_code = 'full_day'),
  'Cy: no Full day at the check-ins (Tidy was still due on 28 Sep)');

-- One catch-up call settles everything up to 21 Oct. Rest well (and every other badge) is queued in its
-- habit loop and written once after it (per-person rows after the last habit lock).
create function tests.no_badge_in_finalize_loop() returns trigger language plpgsql as $$
begin
  if current_setting('keepup.defer_levels', true) = 'on' then
    raise exception 'user_achievements written inside the finalize habit loop';
  end if;
  return new;
end;
$$;
create trigger user_achievements_not_in_loop before insert on public.user_achievements for each row execute function tests.no_badge_in_finalize_loop();
select lives_ok($$select private.finalize_periods('2026-10-22 01:00+02')$$, 'finalize writes no badge row inside its habit loop');
drop trigger user_achievements_not_in_loop on public.user_achievements;
create function pg_temp.outcomes(p_habit uuid, p_from date, p_to date) returns text[] language sql as $$
  select array_agg(outcome order by period_start) from public.period_results where habit_id = p_habit and period_start between p_from and p_to;
$$;

select is(private.rest_days_left(h, '2026-10-08'), 1, '7 done days earn one rest day') from public.habits h where h.id = '00000000-0000-0000-0000-0000000000d1';
select is(pg_temp.outcomes('00000000-0000-0000-0000-0000000000d1', '2026-10-08', '2026-10-09'), array['rested', 'done'], 'a missed day uses it: rested');
select is((select s.run from public.habits h, private.streak_at(h, '2026-10-09') s where h.id = '00000000-0000-0000-0000-0000000000d1'), 8,
  'rested keeps the streak but doesn''t add to it (7 + 1)');
select is((select payload ->> 'streak' || ':' || (payload ->> 'period') || ':' || push::text from public.notifications
            where kind = 'rest_day_used' and habit_id = '00000000-0000-0000-0000-0000000000d1'), '7:day:false',
  'one Inbox row says the 7-day streak is safe (Inbox only by default)');
select ok(exists (select 1 from public.user_achievements where user_id = '00000000-0000-0000-0000-0000000000a1' and achievement_code = 'rest_well'),
  'Rest well: the first rest day used');
select is(private.rest_days_left(h, '2026-10-22'), 2, 'at most 2 saved (21 done days)') from public.habits h where h.id = '00000000-0000-0000-0000-0000000000d2';
select is(pg_temp.outcomes('00000000-0000-0000-0000-0000000000d3', '2026-10-08', '2026-10-10'), array['rested', 'missed', 'missed'],
  'one call settles three missed days with one rest day saved: rested, missed, missed');
select is(pg_temp.outcomes('00000000-0000-0000-0000-0000000000d4', '2026-10-08', '2026-10-09'), array['skipped', 'rested'],
  'a paused day keeps the rest day (it is used the next day)');
select is(pg_temp.outcomes('00000000-0000-0000-0000-0000000000d5', '2026-10-05', '2026-10-12'), array['rested', 'missed'],
  'a weekly habit: 4 done weeks earn a rest week');
select is(pg_temp.outcomes('00000000-0000-0000-0000-0000000000d6', '2026-10-08', '2026-10-08'), array['missed'], 'group habits have no rest days');
select is(pg_temp.outcomes('00000000-0000-0000-0000-0000000000d7', '2026-09-01', '2026-09-01'), array['missed'], 'monthly habits have none');
select is(pg_temp.outcomes('00000000-0000-0000-0000-0000000000d8', '2026-10-08', '2026-10-08'), array['rested'], 'a child''s own habit gets one too');
select is((select count(*)::int from public.notifications where kind = 'rest_day_used' and habit_id = '00000000-0000-0000-0000-0000000000d8'), 0,
  'with no Inbox row (adults only)');

-- Every outcome reader shows it (the app labels it "Rest day") and leaves it out of what was possible.
select is((select outcome from private.habit_history('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1',
            '2026-10-12 12:00+02', 7) where period_start = '2026-10-08'), 'rested', 'habit history reads rested');
select is((select outcome from private.calendar_cells_impl('00000000-0000-0000-0000-0000000000a1', '2026-10-08', '2026-10-08', '2026-10-12 12:00+02')
            where habit_id = '00000000-0000-0000-0000-0000000000d1'), 'rested', 'the calendar reads rested');
-- 8 Oct: Walk done; Read and Stretch rested, Yoga paused (out); Dinner (group) missed. 1 of 2.
select is((select d ->> 'daily_done' || '/' || (d ->> 'daily_possible') || ':' || (
             select c ->> 'status' from jsonb_array_elements(w -> 'per_habit') p, jsonb_array_elements(p -> 'cells') c
              where p ->> 'habit_id' = '00000000-0000-0000-0000-0000000000d1' and c ->> 'period_start' = '2026-10-08')
             from (select private.week_overview_impl('00000000-0000-0000-0000-0000000000a1', '2026-10-09 12:00+02') w) o,
                  jsonb_array_elements(o.w -> 'days') d
            where d ->> 'local_date' = '2026-10-08'), '1/2:rested',
  'the week overview shows a rest day and doesn''t count it as possible');

-- Controller ruling: a rested day counts like a paused one for Perfect week and Full day.
select ok(exists (select 1 from public.user_achievements where user_id = '00000000-0000-0000-0000-0000000000b1' and achievement_code = 'perfect_week'),
  'Perfect week: a rest day doesn''t break the week');
select ok(private.full_day('00000000-0000-0000-0000-0000000000b1', '2026-09-28'), 'Full day leaves a rested habit out (2 of 2 others done)');
select is((select unlocked_at from public.user_achievements where user_id = '00000000-0000-0000-0000-0000000000c1' and achievement_code = 'full_day'),
  '2026-10-22 01:00+02'::timestamptz, 'a day whose only miss became rested earns Full day at the settle (written after the loop)');
select is((select coalesce(string_agg(payload ->> 'streak', ','), 'none') from public.notifications
            where kind = 'private_streak_ended' and habit_id = '00000000-0000-0000-0000-0000000000d1' and dedupe_key like '%:2026-10-08:%')
          || ':' || (select payload ->> 'streak' from public.notifications
            where kind = 'private_streak_ended' and habit_id = '00000000-0000-0000-0000-0000000000d3' and dedupe_key like '%:2026-10-09:%'),
  'none:7', 'a rested day sends no "streak ended" note; the next real miss reports the run kept (7)');

-- A late tap on the rested day upgrades it to done and gives the rest day back. Anna 10 XP below her
-- next level: the tap's +10 crosses it, and that level row must wait for the one sync after
-- resettle_period has upgraded the period (habit → check-in → period_results → per-person rows).
insert into public.xp_events (user_id, amount, reason, source_type, source_id)
select u, b - s - 10, 'milestone', 'streak', 'trap-' || u
  from (select x.user_id as u, sum(x.amount)::int as s, 50 * private.level_for(sum(x.amount)) ^ 2 as b
          from public.xp_events x where x.user_id = '00000000-0000-0000-0000-0000000000a1' group by x.user_id) z
 where b - s - 10 <> 0;
create function tests.no_level_before_rest_upgrade() returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.period_results r
              where r.habit_id = '00000000-0000-0000-0000-0000000000d1' and r.period_start = '2026-10-08' and r.outcome = 'rested') then
    raise exception 'level_ups written before the rested period was upgraded';
  end if;
  return new;
end;
$$;
create trigger level_ups_after_upgrade before insert on public.level_ups for each row execute function tests.no_level_before_rest_upgrade();
select lives_ok($$select private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '2026-10-10 09:00+02',
  null, false, 'c0000000-0000-0000-0000-0000000000d1', '2026-10-08 20:00+02')$$, 'a late tap on a rested day syncs levels once, after the upgrade');
drop trigger level_ups_after_upgrade on public.level_ups;
select is((select outcome || ':' || private.rest_days_left(h, '2026-10-10') from public.period_results r join public.habits h on h.id = r.habit_id
            where r.habit_id = '00000000-0000-0000-0000-0000000000d1' and r.period_start = '2026-10-08'), 'done:1',
  'a late check-in on a rested day upgrades it and refunds the rest day');
select is(private.finalize_periods('2026-10-22 01:00+02'), 0, 'finalizing again changes nothing');

-- Steady month: November has five weeks, four done and one rested (like a skipped week, it doesn't
-- break the month). October (three done, one paused) doesn't count. Settled one by one, through the trigger.
create function pg_temp.settle(p_habit uuid, p_week date, p_outcome text) returns void language sql as $$
  insert into public.period_results (habit_id, period_start, outcome, finalized_at)
  values (p_habit, p_week, p_outcome, (p_week + 7)::timestamp at time zone 'Europe/Rome' + interval '1 hour');
$$;
delete from public.period_results where habit_id = '00000000-0000-0000-0000-0000000000f4'; -- the catch-up above settled it
select pg_temp.settle('00000000-0000-0000-0000-0000000000f4', w::date, o)
  from (values ('2026-10-05', 'done'), ('2026-10-12', 'done'), ('2026-10-19', 'done'), ('2026-10-26', 'skipped'),
               ('2026-11-02', 'done'), ('2026-11-09', 'rested'), ('2026-11-16', 'done'), ('2026-11-23', 'done')) v(w, o)
 order by w;
select ok(not exists (select 1 from public.user_achievements where user_id = '00000000-0000-0000-0000-0000000000c2' and achievement_code = 'steady_month'),
  'not yet: three done weeks in November');
select pg_temp.settle('00000000-0000-0000-0000-0000000000f4', '2026-11-30', 'done');
select ok(exists (select 1 from public.user_achievements where user_id = '00000000-0000-0000-0000-0000000000c2' and achievement_code = 'steady_month'),
  'Steady month: four done weeks and a rested one');

select * from finish();
rollback;
