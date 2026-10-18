-- Habits remember which template they came from (plans/2026-10-15-keepup-languages.md, task 8.5):
-- a template habit shows its name in each viewer's language; a hand-typed name stays as typed. The
-- app reads it in the next PR. Ids are the catalog keys (supabase/functions/_shared/messages/en.json
-- → templates): '<id>' for adult and group templates, 'kid.<id>' for kid templates. No FK: the
-- templates live in the app catalog.
--
-- Replaced functions are copied from their latest definitions; only template_id is added:
--   private.create_group_habit_impl, public.create_group_habit   20260930100100_group_habits.sql
--   private.create_child_habit_impl, public.create_child_habit   20260930100200_children.sql
--   private.start_demo_impl                                      20261021113700_demo_recaps.sql
--   private.subject_summaries, public.habit_summaries            20260930100100_group_habits.sql
--   public.child_summaries                                       20260930100200_children.sql
--   private.pending_approvals_impl                               20261006100000_offline_check_ins.sql
--   public.pending_approvals                                     20260930100300_feed_nudges_cheers.sql
--   private.push_job_build                                       20261023100000_languages.sql
--   private.inbox_feed_impl, public.inbox_feed                   20261009110000_polish.sql
--   private.week_overview_impl                                   20261009130000_calendar_group_habits.sql
--   private.family_recaps_impl, public.family_recaps             20260930100400_kid_rewards_celebrations.sql
-- New return columns go last (drop + create; the public wrappers select * from the impls).

-- 1. The column. The app inserts habits itself (lib/habit-create.ts), so it may set it on insert.
alter table public.habits
  add column template_id text constraint habits_template_id_check check (template_id ~ '^[a-z0-9-]+(\.[a-z0-9-]+)?$');
grant insert (template_id) on public.habits to authenticated;

-- 2. The English template titles, generated from en.json (adult, group and kid; treats are not
-- habits). kind: 'adult', 'group' (g-*) or 'kid'.
create function private.habit_templates_en()
returns table (id text, title text, kind text)
language sql
immutable
set search_path = ''
as $$
  values
    ('water', 'Drink water', 'adult'),
    ('sleep', 'Sleep by 23:00', 'adult'),
    ('vitamins', 'Take vitamins or meds', 'adult'),
    ('veggies', 'Eat fruit or vegetables', 'adult'),
    ('brush-teeth', 'Brush teeth', 'adult'),
    ('wake-up', 'Wake up before 07:00', 'adult'),
    ('steps', 'Walk 10,000 steps', 'adult'),
    ('workout', 'Work out', 'adult'),
    ('stretch', 'Stretch', 'adult'),
    ('run', 'Run', 'adult'),
    ('yoga', 'Yoga', 'adult'),
    ('swim-cycle', 'Swim or cycle', 'adult'),
    ('meditate', 'Meditate', 'adult'),
    ('journal', 'Journal', 'adult'),
    ('gratitude', 'Gratitude: write 3 things', 'adult'),
    ('no-phone-bed', 'No phone in bed', 'adult'),
    ('outside', 'Time outside', 'adult'),
    ('pray', 'Pray', 'adult'),
    ('read', 'Read 20 min', 'adult'),
    ('language', 'Learn a language', 'adult'),
    ('instrument', 'Practice an instrument', 'adult'),
    ('podcast', 'Podcast or course', 'adult'),
    ('study', 'Study', 'adult'),
    ('write', 'Write', 'adult'),
    ('call', 'Call family or a friend', 'adult'),
    ('message', 'Message someone you miss', 'adult'),
    ('kids-time', 'Phone-free time with the kids', 'adult'),
    ('date-night', 'Date night', 'adult'),
    ('kind', 'Do something kind', 'adult'),
    ('screen-free-dinner', 'Screen-free dinner', 'adult'),
    ('tidy', 'Tidy up', 'adult'),
    ('bed', 'Make the bed', 'adult'),
    ('cook', 'Cook at home', 'adult'),
    ('plants', 'Water the plants', 'adult'),
    ('laundry', 'Laundry', 'adult'),
    ('kitchen', 'Clean the kitchen', 'adult'),
    ('plan-tomorrow', 'Plan tomorrow', 'adult'),
    ('deep-work', 'Deep-work block', 'adult'),
    ('no-work-email', 'No work email after 19:00', 'adult'),
    ('no-spend', 'No-spend day', 'adult'),
    ('log-expenses', 'Log expenses', 'adult'),
    ('budget-check', 'Weekly budget check', 'adult'),
    ('no-sugar', 'No sugar', 'adult'),
    ('no-alcohol', 'No alcohol', 'adult'),
    ('no-social-morning', 'No social media before noon', 'adult'),
    ('no-smoking', 'No smoking', 'adult'),
    ('no-snacking', 'No snacking after dinner', 'adult'),
    ('no-caffeine', 'No caffeine after 14:00', 'adult'),
    ('g-family-dinner', 'Family dinner', 'group'),
    ('g-date-night', 'Date night', 'group'),
    ('g-family-walk', 'Family walk', 'group'),
    ('g-game-night', 'Game night', 'group'),
    ('g-cook-together', 'Cook together', 'group'),
    ('g-tidy-together', 'Tidy up together', 'group'),
    ('kid.brush-teeth', 'Brush teeth', 'kid'),
    ('kid.read-together', 'Read a book together', 'kid'),
    ('kid.tidy-toys', 'Tidy my toys', 'kid'),
    ('kid.bath', 'Bath time', 'kid'),
    ('kid.veggies', 'Eat vegetables', 'kid'),
    ('kid.bedtime', 'Go to bed on time', 'kid'),
    ('kid.dressed', 'Get dressed by myself', 'kid'),
    ('kid.wash-hands', 'Wash hands before eating', 'kid'),
    ('kid.water', 'Drink water', 'kid'),
    ('kid.outside', 'Play outside', 'kid'),
    ('kid.please-thanks', 'Say please and thank you', 'kid'),
    ('kid.chore', 'Help with a chore', 'kid'),
    ('kid.make-bed', 'Make my bed', 'kid'),
    ('kid.fruit', 'Eat a fruit', 'kid'),
    ('kid.clear-plate', 'Clear my plate', 'kid'),
    ('kid.laundry-basket', 'Clothes in the basket', 'kid'),
    ('kid.feed-pet', 'Feed the pet', 'kid'),
    ('kid.plants', 'Water the plants', 'kid'),
    ('kid.homework', 'Do my homework', 'kid'),
    ('kid.school-bag', 'Pack my school bag', 'kid'),
    ('kid.music', 'Practice music', 'kid'),
    ('kid.sports', 'Sports practice', 'kid'),
    ('kid.draw', 'Draw or color', 'kid'),
    ('kid.screen-free', 'A screen-free hour', 'kid');
$$;
revoke execute on function private.habit_templates_en() from public, anon, authenticated;

-- 3. Backfill: a habit whose title is exactly a template's English title gets that template. A kid's
-- habit (owner kind 'child') matches kid templates; anyone else's matches adult and group templates.
-- A title two templates share goes to the one of the habit's own kind (a group habit → the group
-- template; a personal one → the adult template); still two → none. Habits with an id are left alone.
create function private.backfill_habit_template_ids()
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_count int;
begin
  with hk as (
    select h.id, h.title,
           case when h.group_id is not null then 'group' when p.kind = 'child' then 'kid' else 'adult' end as kind
      from public.habits h
      left join public.profiles p on p.id = h.owner_id
     where h.template_id is null
  ),
  cand as (
    select hk.id as habit_id, t.id as template_id, t.kind = hk.kind as same_kind
      from hk
      join private.habit_templates_en() t on t.title = btrim(hk.title)
     where (t.kind = 'kid') = (hk.kind = 'kid')
  ),
  pick as (
    select c.habit_id,
           case when count(*) = 1 then min(c.template_id)
                when count(*) filter (where c.same_kind) = 1 then min(c.template_id) filter (where c.same_kind)
           end as template_id
      from cand c
     group by c.habit_id
  )
  update public.habits h set template_id = pick.template_id
    from pick
   where pick.habit_id = h.id and pick.template_id is not null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function private.backfill_habit_template_ids() from public, anon, authenticated;

select private.backfill_habit_template_ids();

-- 4. A new name is the person's own: renaming drops the template, unless the same update sets one.
create function private.habit_template_on_rename()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.template_id := null;
  return new;
end;
$$;
revoke execute on function private.habit_template_on_rename() from public, anon, authenticated;

create trigger habits_template_on_rename
  before update of title on public.habits
  for each row
  when (new.title is distinct from old.title and new.template_id is not distinct from old.template_id)
  execute function private.habit_template_on_rename();

-- 5. Create paths take the template (optional, last; the demo calls the impls positionally).
drop function public.create_group_habit(uuid, text, text, public.habit_category, smallint, public.habit_period, date, boolean, uuid[]);
drop function private.create_group_habit_impl(uuid, uuid, text, text, public.habit_category, int, public.habit_period, date, boolean, uuid[], timestamptz);
create function private.create_group_habit_impl(
  p_actor uuid, p_group_id uuid, p_title text, p_emoji text, p_category public.habit_category,
  p_target_count int, p_period public.habit_period, p_starts_on date, p_requires_approval boolean,
  p_children uuid[], p_now timestamptz, p_template_id text default null)
returns public.habits
language plpgsql
set search_path = ''
as $$
declare
  v_habit public.habits;
begin
  perform private.require_admin(p_group_id, p_actor);
  if exists (
    select 1 from unnest(coalesce(p_children, '{}')) x(id)
     where not exists (select 1 from public.profiles c where c.id = x.id and c.kind = 'child' and c.group_id = p_group_id)) then
    raise exception 'keepup:child_not_found' using errcode = 'P0002';
  end if;

  insert into public.habits (owner_id, group_id, title, emoji, category, target_count, period, starts_on,
                             requires_approval, created_by, created_at, template_id)
  values (null, p_group_id, p_title, p_emoji, p_category, p_target_count, p_period, p_starts_on,
          coalesce(p_requires_approval, false), p_actor, p_now, p_template_id)
  returning * into v_habit;

  insert into public.group_habit_participants (habit_id, profile_id)
  select distinct v_habit.id, x.id from unnest(coalesce(p_children, '{}')) x(id);
  return v_habit;
end;
$$;
revoke execute on function private.create_group_habit_impl(uuid, uuid, text, text, public.habit_category, int, public.habit_period, date, boolean, uuid[], timestamptz, text)
  from public, anon, authenticated;

create function public.create_group_habit(
  p_group_id uuid, p_title text, p_emoji text, p_category public.habit_category, p_target_count smallint,
  p_period public.habit_period, p_starts_on date default null, p_requires_approval boolean default false,
  p_children uuid[] default '{}', p_template_id text default null)
returns public.habits language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return private.create_group_habit_impl(auth.uid(), p_group_id, p_title, p_emoji, p_category, p_target_count,
    p_period, p_starts_on, p_requires_approval, p_children, now(), p_template_id);
end;
$$;
revoke execute on function public.create_group_habit(uuid, text, text, public.habit_category, smallint, public.habit_period, date, boolean, uuid[], text)
  from public, anon;
grant execute on function public.create_group_habit(uuid, text, text, public.habit_category, smallint, public.habit_period, date, boolean, uuid[], text)
  to authenticated;

drop function public.create_child_habit(uuid, text, text, smallint, public.habit_period, date);
drop function private.create_child_habit_impl(uuid, uuid, text, text, int, public.habit_period, date);
create function private.create_child_habit_impl(
  p_actor uuid, p_child_id uuid, p_title text, p_emoji text, p_target_count int, p_period public.habit_period, p_starts_on date,
  p_template_id text default null)
returns public.habits
language plpgsql
set search_path = ''
as $$
declare
  v_habit public.habits;
begin
  perform private.require_guardian(p_actor, p_child_id);
  insert into public.habits (owner_id, title, emoji, category, target_count, period, starts_on, created_by, template_id)
  values (p_child_id, p_title, p_emoji, null, p_target_count, p_period, p_starts_on, p_actor, p_template_id)
  returning * into v_habit;
  return v_habit;
end;
$$;
revoke execute on function private.create_child_habit_impl(uuid, uuid, text, text, int, public.habit_period, date, text)
  from public, anon, authenticated;

create function public.create_child_habit(
  p_child_id uuid, p_title text, p_emoji text, p_target_count smallint, p_period public.habit_period, p_starts_on date default null,
  p_template_id text default null)
returns public.habits language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return private.create_child_habit_impl(auth.uid(), p_child_id, p_title, p_emoji, p_target_count, p_period, p_starts_on, p_template_id);
end;
$$;
revoke execute on function public.create_child_habit(uuid, text, text, smallint, public.habit_period, date, text) from public, anon;
grant execute on function public.create_child_habit(uuid, text, text, smallint, public.habit_period, date, text) to authenticated;

-- The demo's template habits (Drink water, Meditate, Family dinner, Brush teeth) carry their template.
create or replace function private.start_demo_impl(p_user uuid, p_timezone text, p_now timestamptz)
returns void language plpgsql set search_path = '' as $$
declare
  v_tz text := case when public.is_valid_timezone(coalesce(p_timezone, '')) then p_timezone else 'UTC' end;
  v_today date := (p_now at time zone v_tz)::date;
  v_week date := private.period_start('week', (p_now at time zone v_tz)::date, 1::smallint);
  v_alex uuid := gen_random_uuid();
  v_profile public.profiles;
  v_group uuid; v_nova uuid;
  v_read uuid; v_water uuid; v_walk uuid; v_meditate uuid;
  v_dinner uuid; v_together uuid; v_brush uuid; v_story uuid; v_tidy uuid;
  v_seeded uuid[];
  v_habit public.habits;
  v_ps date;
  r record;
begin
  select * into v_profile from public.profiles where id = p_user for update;
  if not found or not v_profile.is_demo then
    raise exception 'keepup:not_demo' using errcode = '42501';
  end if;
  if v_profile.onboarded_at is not null then
    return; -- a second tap: already seeded
  end if;

  -- 1. People and the group, through the normal functions (triggers on).
  update public.profiles set display_name = 'Sam', timezone = v_tz, week_start = 1, purpose = 'family',
         avatar_emoji = '🌻', avatar_color = 'butter', onboarded_at = p_now
   where id = p_user;
  insert into public.profiles (id, display_name, timezone, week_start, is_demo, onboarded_at, avatar_emoji, avatar_color, created_at)
  values (v_alex, 'Alex', v_tz, 1, true, p_now, '🦊', 'peach', p_now);
  v_group := (private.create_group_impl(p_user, 'Family', 'family')).id;
  insert into public.group_members (group_id, user_id, role) values (v_group, v_alex, 'member');
  v_nova := private.create_child_impl(p_user, v_group, 'Nova', '🐼', 'sage', true);

  -- 2. Habits, starting today (the rules allow no past start); backdated in step 3.
  insert into public.habits (owner_id, created_by, title, emoji, category, target_count, period, starts_on)
  values (p_user, p_user, 'Read', '📚', 'learning', 1, 'day', v_today) returning id into v_read;
  insert into public.habits (owner_id, created_by, title, emoji, category, target_count, period, starts_on, template_id)
  values (p_user, p_user, 'Drink water', '💧', 'health', 1, 'day', v_today, 'water') returning id into v_water;
  insert into public.habits (owner_id, created_by, title, emoji, category, target_count, period, starts_on)
  values (p_user, p_user, 'Walk', '🚶', 'fitness', 3, 'week', v_today) returning id into v_walk;
  insert into public.habits (owner_id, created_by, title, emoji, category, target_count, period, starts_on, template_id)
  values (p_user, p_user, 'Meditate', '🧘', 'mind', 1, 'day', v_today, 'meditate') returning id into v_meditate;
  -- No children: the adults take part through membership (ADR 0012), not group_habit_participants.
  v_dinner := (private.create_group_habit_impl(p_user, v_group, 'Family dinner', '🍽️', 'people', 1, 'week', v_today, false, '{}', p_now, 'g-family-dinner')).id;
  v_together := (private.create_group_habit_impl(p_user, v_group, 'Walk together', '🚶', 'fitness', 2, 'week', v_today, true, '{}', p_now)).id;
  v_brush := (private.create_child_habit_impl(p_user, v_nova, 'Brush teeth', '🪥', 2, 'day', v_today, 'kid.brush-teeth')).id;
  v_story := (private.create_child_habit_impl(p_user, v_nova, 'Read a story', '📖', 1, 'day', v_today)).id;
  v_tidy := (private.create_child_habit_impl(p_user, v_nova, 'Tidy toys', '🧸', 1, 'day', v_today)).id;
  perform private.set_treat_goal_impl(p_user, v_nova, 'Trip to the park', '🛝', 20);
  v_seeded := array[v_read, v_water, v_walk, v_meditate, v_dinner, v_together, v_brush, v_story, v_tidy];

  -- 3. History with triggers off.
  set local session_replication_role = replica;
  update public.habits set starts_on = v_today - 30, created_at = p_now - interval '30 days'
   where id in (v_read, v_water, v_walk, v_meditate, v_brush, v_story, v_tidy);
  update public.habits set starts_on = v_today - 42, created_at = p_now - interval '42 days' where id in (v_dinner, v_together);
  -- The avatar here too: each update of a group re-runs its time zone check (~25 ms).
  update public.groups set created_at = p_now - interval '45 days', avatar_emoji = '🏡', avatar_color = 'sage' where id = v_group;
  update public.group_members set joined_at = p_now - interval '45 days' where group_id = v_group;
  -- The goal starts at the seed moment (not the real clock), so a run at a given p_now counts 0 stars.
  update public.treat_goals set created_at = p_now where child_id = v_nova and received_at is null;

  -- 3a. Private check-ins, d days ago (1..30). Read: every day for 12 days, d=13 missed, ~3 of 4 before.
  insert into public.check_ins (habit_id, user_id, local_date, period_start, status, created_at, tapped_at)
  select h.id, p_user, v_today - d, private.period_start(h.period, v_today - d, h.week_start), 'approved',
         ((v_today - d) + time '19:30') at time zone v_tz, ((v_today - d) + time '19:30') at time zone v_tz
    from public.habits h cross join generate_series(1, 30) d
   where (h.id = v_read and (d <= 12 or (d >= 14 and d % 4 <> 0)))
      or (h.id = v_water and d % 5 <> 0)
      or (h.id = v_walk and d % 2 = 1)
      or (h.id = v_meditate and d % 2 = 0 and d not between 8 and 14);
  insert into public.habit_freezes (habit_id, starts_on, ends_on, created_by, created_at)
  values (v_meditate, v_today - 14, v_today - 8, p_user, p_now - interval '15 days');

  -- 3b. Group: dinner by both in each of the last 5 closed weeks (a 5-week streak); walk together 2× by
  -- both, approved by the other, in the last 3 (the 2 weeks before are missed).
  insert into public.check_ins (habit_id, user_id, local_date, period_start, status, created_at, logged_by, reviewed_by, reviewed_at)
  select v_dinner, u, v_week - 7 * w + 4, v_week - 7 * w, 'approved', ((v_week - 7 * w + 4) + time '19:00') at time zone v_tz, u,
         null::uuid, null::timestamptz
    from generate_series(1, 5) w cross join unnest(array[p_user, v_alex]) u
  union all
  select v_together, u, v_week - 7 * w + k, v_week - 7 * w, 'approved', ((v_week - 7 * w + k) + time '18:00') at time zone v_tz, u,
         case when u = p_user then v_alex else p_user end, ((v_week - 7 * w + k) + time '20:00') at time zone v_tz
    from generate_series(1, 3) w cross join unnest(array[p_user, v_alex]) u cross join unnest(array[1, 5]) k;

  -- 3c. Nova: every slot last week, and the first 7 slots this week (4 per elapsed day), logged by Sam.
  -- Today's never after now (a visitor before 08:00), and none counts toward the new treat goal.
  insert into public.check_ins (habit_id, user_id, local_date, period_start, status, created_at, logged_by)
  with slots as (
    select h.id as habit_id, d::date as day, n
      from public.habits h
     cross join generate_series((v_week - 7)::timestamp, v_today::timestamp, interval '1 day') d
     cross join lateral generate_series(1, h.target_count::int) n
     where h.id in (v_brush, v_story, v_tidy)),
  picked as (
    select * from slots where day < v_week
    union all
    (select * from slots where day >= v_week order by day, habit_id, n limit 7))
  select habit_id, v_nova, day, day, 'approved',
         least((day + time '08:00') at time zone v_tz, p_now - interval '1 minute'), p_user
    from picked;

  -- 3d. A result for every closed period of every seeded habit, oldest first and one per statement
  -- (rest_days_left reads the earlier ones), by finalize's own rule.
  for v_habit in select h.* from public.habits h where h.id = any (v_seeded) order by h.id loop
    for v_ps in
      select s.d::date
        from generate_series(private.first_period_start(v_habit)::timestamp,
                             private.habit_period_start(v_habit, private.habit_today(v_habit, p_now))::timestamp
                               - private.period_step(v_habit.period),
                             private.period_step(v_habit.period)) s(d)
       order by 1
    loop
      insert into public.period_results (habit_id, period_start, outcome, finalized_at)
      values (v_habit.id, v_ps, private.settled_outcome(v_habit, v_ps), p_now);
    end loop;
  end loop;
  set local session_replication_role = origin;

  -- 4. Rewards, curated: clear what setup produced, write a level-4 ledger (40 × 10 + 4 × 20 = 480), then
  -- award what the history earns, quietly. Periods: only done and rested ones can earn anything here (a
  -- missed or skipped one only judges Perfect week, which its week's done periods judge too; the seeded
  -- missed group weeks have no check-ins); skipping them saves ~75 badge calls.
  delete from public.notifications where user_id in (p_user, v_alex);
  delete from public.xp_events where user_id in (p_user, v_alex);
  delete from public.level_ups where user_id in (p_user, v_alex);
  delete from public.user_achievements where user_id in (p_user, v_alex, v_nova);
  insert into public.xp_events (user_id, amount, reason, source_type, source_id, habit_id, created_at)
  select p_user, 10, 'check_in', 'check_in', c.id::text, c.habit_id, c.created_at
    from (select * from public.check_ins where user_id = p_user and status = 'approved' order by created_at desc limit 40) c;
  insert into public.xp_events (user_id, amount, reason, source_type, source_id, habit_id, created_at)
  select p_user, 20, 'period_done', 'period', x.habit_id || ':' || x.period_start, x.habit_id, p_now
    from (select * from public.period_results where habit_id = v_read and outcome = 'done' order by period_start desc limit 4) x;
  insert into public.level_ups (user_id, level, reached_at, seen_at)
  select p_user, l, p_now - (5 - l) * interval '6 days', p_now from generate_series(2, 4) l;
  for v_habit in select h.* from public.habits h where h.id = any (v_seeded) order by h.created_at, h.id loop
    perform private.badges_on_habit(v_habit, true);
  end loop;
  for r in select c from public.check_ins c
            where c.habit_id = any (v_seeded) and c.status = 'approved' order by c.created_at, c.id loop
    perform private.badges_on_check_in(r.c, true);
    perform private.badges_on_review(r.c, true);
  end loop;
  for r in select h as habit, x.period_start, x.outcome from public.period_results x join public.habits h on h.id = x.habit_id
            where x.habit_id = any (v_seeded) and x.outcome in ('done', 'rested')
            order by x.period_start, x.habit_id loop
    perform private.badges_on_period(r.habit, r.period_start, r.outcome, p_now, true);
  end loop;
  update public.user_achievements set seen_at = p_now where user_id in (p_user, v_alex, v_nova) and seen_at is null;
  delete from public.notifications where user_id in (p_user, v_alex);

  -- 5. Today, triggers on: Alex's walk waits for Sam (an Inbox row appears).
  insert into public.check_ins (habit_id, user_id, local_date, period_start, status, logged_by, created_at)
  values (v_together, v_alex, v_today, v_week, 'pending', v_alex, p_now);
end;
$$;

-- 6. Reads: Today, Progress and the kid view.
drop function public.habit_summaries();
drop function public.child_summaries(uuid);
drop function private.subject_summaries(uuid, timestamptz);
create function private.subject_summaries(p_subject uuid, p_now timestamptz)
returns table (
  habit_id uuid, title text, category public.habit_category, emoji text, target_count smallint,
  period public.habit_period, starts_on date, created_at timestamptz, archived_at timestamptz,
  period_start date, not_started boolean, done_count int, checked_in_today boolean, frozen boolean,
  frozen_until date, days_left int, current_streak int, best_streak int,
  group_id uuid, group_name text, requires_approval boolean, pending_count int, group_done boolean,
  my_role text, members jsonb, template_id text)
language sql
stable
set search_path = ''
as $$
  select h.id, h.title, h.category, h.emoji, h.target_count, h.period, h.starts_on, h.created_at, h.archived_at,
         cur.start,
         ctx.today < h.starts_on,
         (select count(*)::int from public.check_ins c
           where c.habit_id = h.id and c.user_id = p_subject and c.period_start = cur.start and c.status = 'approved'),
         exists (select 1 from public.check_ins c
                  where c.habit_id = h.id and c.user_id = p_subject and c.local_date = ctx.today and c.status <> 'rejected'),
         private.is_frozen(h.id, ctx.today, ctx.today + 1) or private.is_member_frozen(h.id, p_subject, ctx.today, ctx.today + 1),
         (select f.ends_on from public.habit_freezes f
           where f.habit_id = h.id and (f.user_id is null or f.user_id = p_subject)
             and f.starts_on <= ctx.today and coalesce(f.ends_on, 'infinity'::date) >= ctx.today
           -- An open-ended or later-ending pause wins when a whole-habit and a member pause both cover today.
           order by f.ends_on desc nulls first
           limit 1),
         (cur.finish - ctx.today),
         st.current_streak, st.best_streak,
         h.group_id, g.name, h.requires_approval,
         (select count(*)::int from public.check_ins c
           where c.habit_id = h.id and c.user_id = p_subject and c.period_start = cur.start and c.status = 'pending'),
         private.period_outcome(h, cur.start) = 'done',
         private.habit_role(h, p_subject),
         case when h.group_id is null then null else (
           select coalesce(jsonb_agg(jsonb_build_object(
                    'profile_id', p.id, 'name', p.display_name, 'avatar_emoji', p.avatar_emoji,
                    'avatar_color', p.avatar_color, 'kind', p.kind,
                    'required', p.id = any(req.ids),
                    'done_count', (select count(*)::int from public.check_ins c
                                    where c.habit_id = h.id and c.user_id = p.id and c.period_start = cur.start and c.status = 'approved'),
                    'pending_count', (select count(*)::int from public.check_ins c
                                       where c.habit_id = h.id and c.user_id = p.id and c.period_start = cur.start and c.status = 'pending'),
                    'paused', private.is_member_frozen(h.id, p.id, ctx.today, ctx.today + 1))
                  order by p.kind, p.display_name), '[]'::jsonb)
             -- Same people as takes_part: current adult members, plus included children still in the group.
             from (select m.user_id as id from public.group_members m
                    where m.group_id = h.group_id and m.left_at is null
                   union
                   select gp.profile_id from public.group_habit_participants gp
                     join public.profiles c on c.id = gp.profile_id
                    where gp.habit_id = h.id and c.group_id = h.group_id) x
             join public.profiles p on p.id = x.id)
         end,
         h.template_id
    from public.habits h
    left join public.groups g on g.id = h.group_id
    cross join lateral (select private.habit_today(h, p_now) as today) ctx
    cross join lateral (select private.habit_period_start(h, ctx.today) as start) s0
    cross join lateral (select s0.start, private.period_end(h.period, s0.start) as finish) cur
    cross join lateral private.habit_streaks(h.id, p_now) st
    -- Required members once per habit, not once per member row.
    cross join lateral (select case when h.group_id is null then '{}'::uuid[]
                                    else array(select private.required_members(h, cur.start)) end as ids) req
   -- The habits p_subject takes part in (same rule as takes_part), as index-friendly branches.
   where h.id in (
           select o.id from public.habits o where o.owner_id = p_subject
           union all
           select gh.id from public.group_members m
             join public.habits gh on gh.group_id = m.group_id
            where m.user_id = p_subject and m.left_at is null
           union all
           select gp.habit_id from public.group_habit_participants gp
             join public.profiles c on c.id = gp.profile_id
             join public.habits ph on ph.id = gp.habit_id and ph.group_id = c.group_id
            where gp.profile_id = p_subject)
   order by h.archived_at nulls first, h.group_id nulls first, h.created_at;
$$;

create function public.habit_summaries()
returns table (
  habit_id uuid, title text, category public.habit_category, emoji text, target_count smallint,
  period public.habit_period, starts_on date, created_at timestamptz, archived_at timestamptz,
  period_start date, not_started boolean, done_count int, checked_in_today boolean, frozen boolean,
  frozen_until date, days_left int, current_streak int, best_streak int,
  group_id uuid, group_name text, requires_approval boolean, pending_count int, group_done boolean,
  my_role text, members jsonb, template_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.subject_summaries(auth.uid(), now());
$$;

create function public.child_summaries(p_child_id uuid)
returns table (
  habit_id uuid, title text, category public.habit_category, emoji text, target_count smallint,
  period public.habit_period, starts_on date, created_at timestamptz, archived_at timestamptz,
  period_start date, not_started boolean, done_count int, checked_in_today boolean, frozen boolean,
  frozen_until date, days_left int, current_streak int, best_streak int,
  group_id uuid, group_name text, requires_approval boolean, pending_count int, group_done boolean,
  my_role text, members jsonb, template_id text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  perform private.require_guardian(auth.uid(), p_child_id);
  return query select * from private.subject_summaries(p_child_id, now());
end;
$$;
revoke execute on function public.habit_summaries(), public.child_summaries(uuid) from public, anon;
grant execute on function public.habit_summaries(), public.child_summaries(uuid) to authenticated;

-- 7. Reads: approvals (the Inbox list and the approval pushes).
drop function public.pending_approvals();
drop function private.pending_approvals_impl(uuid, timestamptz);
create function private.pending_approvals_impl(p_user uuid, p_now timestamptz)
returns table (
  check_in_id uuid, habit_id uuid, habit_title text, habit_emoji text, group_id uuid, group_name text,
  author_id uuid, author_name text, author_avatar_emoji text, author_avatar_color text,
  local_date date, created_at timestamptz, review_deadline timestamptz, habit_template text)
language sql
stable
set search_path = ''
as $$
  select c.id, h.id, h.title, h.emoji, g.id, g.name, p.id, p.display_name, p.avatar_emoji, p.avatar_color,
         c.local_date, c.created_at, private.check_in_deadline(h, c), h.template_id
    from public.check_ins c
    join public.habits h on h.id = c.habit_id
    join public.groups g on g.id = h.group_id
    join public.profiles p on p.id = c.user_id
   where c.status = 'pending'
     and c.user_id <> p_user
     and private.is_member(h.group_id, p_user)
     and p_now < private.check_in_deadline(h, c)
   order by c.created_at;
$$;

create function public.pending_approvals()
returns table (
  check_in_id uuid, habit_id uuid, habit_title text, habit_emoji text, group_id uuid, group_name text,
  author_id uuid, author_name text, author_avatar_emoji text, author_avatar_color text,
  local_date date, created_at timestamptz, review_deadline timestamptz, habit_template text)
language sql stable security definer set search_path = '' as $$
  select * from private.pending_approvals_impl(auth.uid(), now());
$$;
revoke execute on function public.pending_approvals() from public, anon;
grant execute on function public.pending_approvals() to authenticated;

-- 8. Reads: pushes (habit_template next to habit, also in the pending list).
create or replace function private.push_job_build(p_id uuid, p_now timestamptz default now())
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', n.id, 'kind', n.kind, 'user_id', n.user_id, 'pushed', n.pushed_at is not null,
    'group_id', n.group_id, 'group', g.name, 'habit_id', n.habit_id, 'habit', h.title, 'habit_template', h.template_id, 'period', h.period,
    'target', h.target_count, 'check_in_id', n.check_in_id, 'check_in_status', c.status,
    'actor', a.display_name, 'subject_id', n.subject_id, 'subject', s.display_name, 'payload', n.payload,
    'silent', coalesce(np.delivery, 'silent') <> 'sound',
    'locale', coalesce(r.locale, 'en'),
    'subject_gender', s.gender,
    'names', case when n.kind = 'group_check_in' then (
      select coalesce(jsonb_agg(x.name order by x.first), '[]'::jsonb)
        from (select ap.display_name as name, min(o.created_at) as first
                from public.notifications o
                join public.check_ins oc on oc.id = o.check_in_id
                join public.profiles ap on ap.id = o.actor_id
               where o.user_id = n.user_id and o.kind = 'group_check_in' and o.habit_id = n.habit_id
                 and oc.local_date = c.local_date
               group by ap.id, ap.display_name) x)
      else '[]'::jsonb end,
    'pending', case when n.kind in ('approval_needed', 'approval_expiring') then (
      select coalesce(jsonb_agg(jsonb_build_object('check_in_id', pa.check_in_id, 'author', pa.author_name, 'habit', pa.habit_title,
                                                    'habit_template', pa.habit_template)
                                order by pa.created_at), '[]'::jsonb)
        from private.pending_approvals_impl(n.user_id, p_now) pa)
      else '[]'::jsonb end,
    'subscriptions', (
      select coalesce(jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth', ps.auth)), '[]'::jsonb)
        from public.push_subscriptions ps where ps.user_id = n.user_id))
    from public.notifications n
    left join public.groups g on g.id = n.group_id
    left join public.habits h on h.id = n.habit_id
    left join public.check_ins c on c.id = n.check_in_id
    left join public.profiles a on a.id = n.actor_id
    left join public.profiles s on s.id = n.subject_id
    left join public.profiles r on r.id = n.user_id
    left join public.notification_prefs np on np.user_id = n.user_id and np.category = private.push_category(n.kind)
   where n.id = p_id and n.push;
$$;
revoke execute on function private.push_job_build(uuid, timestamptz) from public, anon, authenticated;

-- 9. Reads: the Inbox feed.
drop function public.inbox_feed(int);
drop function private.inbox_feed_impl(uuid, int);
create function private.inbox_feed_impl(p_user uuid, p_limit int)
returns table (
  id uuid, kind text, created_at timestamptz, read_at timestamptz, seen_at timestamptz,
  group_id uuid, group_name text, habit_id uuid, habit_title text, habit_emoji text, check_in_id uuid,
  actor_name text, actor_avatar_emoji text, actor_avatar_color text,
  subject_id uuid, subject_name text, subject_avatar_emoji text, payload jsonb, habit_template text)
language sql
stable
set search_path = ''
as $$
  select n.id, n.kind, n.created_at, n.read_at, n.seen_at, n.group_id, g.name, n.habit_id, h.title, h.emoji, n.check_in_id,
         a.display_name, a.avatar_emoji, a.avatar_color, n.subject_id, s.display_name, s.avatar_emoji, n.payload, h.template_id
    from public.notifications n
    left join public.groups g on g.id = n.group_id
    left join public.habits h on h.id = n.habit_id
    left join public.profiles a on a.id = n.actor_id
    left join public.profiles s on s.id = n.subject_id
   where n.user_id = p_user
   order by n.created_at desc
   limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;
create function public.inbox_feed(p_limit int default 50)
returns table (
  id uuid, kind text, created_at timestamptz, read_at timestamptz, seen_at timestamptz,
  group_id uuid, group_name text, habit_id uuid, habit_title text, habit_emoji text, check_in_id uuid,
  actor_name text, actor_avatar_emoji text, actor_avatar_color text,
  subject_id uuid, subject_name text, subject_avatar_emoji text, payload jsonb, habit_template text)
language sql stable security definer set search_path = '' as $$
  select * from private.inbox_feed_impl(auth.uid(), p_limit);
$$;
revoke execute on function public.inbox_feed(int) from public, anon;
grant execute on function public.inbox_feed(int) to authenticated;

-- 10. Reads: Progress's week overview (best_current_streak_template next to its title).
create or replace function private.week_overview_impl(p_user uuid, p_now timestamptz)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with wk as (
    select t.today, t.week_start, private.period_start('week', t.today, t.week_start) as ws
      from (select private.local_date(p_now, p.timezone) as today, p.week_start
              from public.profiles p where p.id = p_user) t
  ),
  hs as (
    select h as habit, h.id, h.title, h.template_id, h.period, h.target_count, h.created_at, h.ends_on,
           h.ends_on is not null and h.ends_on < private.habit_today(h, p_now) as ended,
           private.first_period_start(h) as first_ps,
           private.habit_period_start(h, wk.today) as cur_ps,
           private.habit_period_start(h, wk.ws - 7) as from_ps
      from public.habits h cross join wk
     where h.owner_id = p_user and h.archived_at is null
  ),
  -- The group habits p_user takes part in (same people as takes_part and subject_summaries).
  gs as (
    select h as habit, h.id, h.title, h.template_id, h.period, h.target_count, h.created_at, h.ends_on,
           h.ends_on is not null and h.ends_on < private.habit_today(h, p_now) as ended,
           private.first_period_start(h) as first_ps,
           private.habit_period_start(h, private.habit_today(h, p_now)) as cur_ps,
           private.habit_period_start(h, wk.ws - 7) as from_ps
      from public.habits h cross join wk
     where h.group_id is not null and h.archived_at is null
       and h.id in (select private.person_group_habits(p_user))
  ),
  -- Every period of every group habit that can touch last week or this week, or is one of its last
  -- 7 (the Progress dots), judged for p_user.
  gperiods as (
    select gs.habit, gs.id, gs.period, gs.target_count, gs.first_ps, gs.cur_ps, gs.from_ps,
           s.d::date as ps, private.period_end(gs.period, s.d::date) as pe, o.due, o.required, o.outcome
      from gs
      cross join lateral generate_series(
        least(gs.from_ps::timestamp, gs.cur_ps::timestamp - private.period_step(gs.period) * 6),
        gs.cur_ps::timestamp, private.period_step(gs.period)) as s(d)
      cross join lateral private.person_period_outcome(gs.habit, p_user, s.d::date, p_now) o
  ),
  -- Every period of every habit that can touch last week or this week, with its outcome. Group
  -- periods you aren't required in aren't here at all.
  periods as (
    select hs.id, hs.period, s.d::date as ps, private.period_end(hs.period, s.d::date) as pe, hs.target_count,
           case
             when s.d::date = hs.cur_ps then
               case when private.period_outcome(hs.habit, hs.cur_ps) = 'done' then 'done' else 'open' end
             else coalesce(
               (select x.outcome from public.period_results x where x.habit_id = hs.id and x.period_start = s.d::date),
               private.period_outcome(hs.habit, s.d::date))
           end as outcome
      from hs
      cross join lateral generate_series(greatest(hs.first_ps, hs.from_ps)::timestamp, hs.cur_ps::timestamp,
                                         private.period_step(hs.period)) as s(d)
     -- Nothing is due after the end (as for group habits): an ended habit's today isn't "to do".
     where hs.ends_on is null or s.d::date <= private.habit_period_start(hs.habit, hs.ends_on)
    union all
    select g.id, g.period, g.ps, g.pe, g.target_count, g.outcome
      from gperiods g
     where g.outcome is not null and g.ps >= g.from_ps
  ),
  anchored as (
    select p.*,
           case p.outcome
             -- user_id: on a group habit, your own target-reaching check-in (on a private habit
             -- every check-in is the owner's anyway).
             when 'done' then coalesce(
               (select c.local_date from public.check_ins c
                 where c.habit_id = p.id and c.user_id = p_user and c.period_start = p.ps and c.status = 'approved'
                 order by c.created_at, c.local_date
                offset p.target_count - 1 limit 1),
               p.pe - 1)
             when 'missed' then p.pe - 1
           end as anchor
      from periods p
  ),
  totals as (
    select count(*) filter (where a.outcome = 'done' and a.anchor >= wk.ws and a.anchor < wk.ws + 7)::int as done,
           count(*) filter (where a.outcome in ('done', 'missed') and a.anchor >= wk.ws and a.anchor < wk.ws + 7)::int as possible,
           count(*) filter (where a.outcome = 'done' and a.anchor >= wk.ws - 7 and a.anchor < wk.ws)::int as prev_done,
           count(*) filter (where a.outcome in ('done', 'missed') and a.anchor >= wk.ws - 7 and a.anchor < wk.ws)::int as prev_possible
      from wk left join anchored a on true
     group by wk.ws
  ),
  -- Today's circle fills against every daily habit that is on today (started, not paused).
  days as (
    select g.d::date as local_date,
           count(p.id) filter (where g.d::date <= wk.today and p.outcome = 'done')::int as daily_done,
           count(p.id) filter (where
             (g.d::date < wk.today and p.outcome in ('done', 'missed'))
             or (g.d::date = wk.today and (p.outcome = 'done' or not private.is_frozen(p.id, wk.today, wk.today + 1)))
           )::int as daily_possible
      from wk
      cross join lateral generate_series(wk.ws::timestamp, (wk.ws + 6)::timestamp, interval '1 day') as g(d)
      left join periods p on p.period = 'day' and p.ps = g.d::date
     group by g.d
  ),
  best as (
    select b.title, b.template_id, b.period, st.current_streak
      from (select hs.id, hs.title, hs.template_id, hs.period, hs.created_at from hs where not hs.ended
            union all
            select gs.id, gs.title, gs.template_id, gs.period, gs.created_at from gs where not gs.ended) b
     cross join lateral private.habit_streaks(b.id, p_now) st
     where st.current_streak > 0
     order by st.current_streak desc, b.created_at
     limit 1
  ),
  -- The last 7 local days (daily habits) or up to 7 periods (weekly, monthly), per habit.
  per_habit as (
    select hs.id, hs.created_at,
           (select jsonb_agg(jsonb_build_object('period_start', c.ps, 'status', c.status) order by c.ps)
              from (
                select coalesce(hh.period_start, g.d::date) as ps,
                       case
                         when hh.outcome is null then 'not_started'
                         when hh.outcome = 'skipped' then
                           case when private.is_frozen(hs.id, hh.period_start, private.period_end(hs.period, hh.period_start))
                                then 'paused' else 'not_started' end
                         else hh.outcome
                       end as status
                  from (select * from private.habit_history(hs.id, p_user, p_now, 7)) hh
                  full join (select d from wk cross join lateral generate_series((wk.today - 6)::timestamp, wk.today::timestamp, interval '1 day') as d
                              where hs.period = 'day') g
                    on hh.period_start = g.d::date
              ) c) as cells
      from hs
    union all
    -- A group habit's dots are yours, with the words habit_history uses: not required in it reads
    -- paused (you or the habit were paused) or not started (you joined after it began).
    select gs.id, gs.created_at,
           (select jsonb_agg(jsonb_build_object('period_start', g.ps, 'status',
                     case
                       when not g.due then 'not_started'
                       when not g.required then
                         case when private.is_member_frozen(g.id, p_user, g.ps, g.pe) or private.is_frozen(g.id, g.ps, g.pe)
                              then 'paused' else 'not_started' end
                       when g.outcome = 'done' then 'done'
                       when g.outcome = 'open' then case when private.is_frozen(g.id, g.ps, g.pe) then 'paused' else 'open' end
                       when g.outcome = 'skipped' then case when private.is_frozen(g.id, g.ps, g.pe) then 'paused' else 'not_started' end
                       -- An approval habit's closed period still waits for reviews (habit_history's grace).
                       when private.in_grace(g.habit, g.ps, p_now) then 'open'
                       else 'missed'
                     end) order by g.ps)
              from gperiods g
             where g.id = gs.id
               and g.ps >= (gs.cur_ps::timestamp - private.period_step(gs.period) * 6)::date
               and (gs.period = 'day' or g.ps >= gs.first_ps)) as cells
      from gs
  )
  select jsonb_build_object(
    'today', wk.today,
    'week_start', wk.ws,
    'done', t.done,
    'possible', t.possible,
    'prev_done', t.prev_done,
    'prev_possible', t.prev_possible,
    'days', (select jsonb_agg(jsonb_build_object('local_date', d.local_date, 'daily_done', d.daily_done,
                                                 'daily_possible', d.daily_possible) order by d.local_date) from days d),
    'best_current_streak', coalesce((select b.current_streak from best b), 0),
    'best_current_streak_title', (select b.title from best b),
    'best_current_streak_template', (select b.template_id from best b),
    'best_current_streak_period', (select b.period from best b),
    -- On a group habit, only check-ins in periods that count for you (required and due).
    'check_ins', (select count(*)::int from public.check_ins c
                   where c.user_id = p_user and c.status = 'approved' and c.local_date >= wk.ws and c.local_date < wk.ws + 7
                     and (c.habit_id in (select hs.id from hs)
                          or exists (select 1 from gperiods g
                                      where g.id = c.habit_id and g.ps = c.period_start and g.due and g.required))),
    -- A habit whose end has passed isn't active (its earlier periods still count above).
    'active_habits', (select count(*)::int from hs where not hs.ended) + (select count(*)::int from gs where not gs.ended),
    'per_habit', coalesce((select jsonb_agg(jsonb_build_object('habit_id', ph.id, 'cells', coalesce(ph.cells, '[]'::jsonb))
                                            order by ph.created_at) from per_habit ph), '[]'::jsonb))
    from wk cross join totals t;
$$;

-- 11. Reads: Today's weekly family card (best_template next to best_title).
drop function public.family_recaps();
drop function private.family_recaps_impl(uuid, timestamptz);
create function private.family_recaps_impl(p_user uuid, p_now timestamptz)
returns table (group_id uuid, group_name text, week_start date, check_ins int, best_title text, best_emoji text,
               best_streak int, best_period public.habit_period, best_template text)
language sql
stable
set search_path = ''
as $$
  with gs as (
    select g.*, private.local_date(p_now, g.timezone) as today
      from public.groups g
      join public.group_members m on m.group_id = g.id and m.user_id = p_user and m.left_at is null
  ), due as (
    select gs.*, gs.today - 7 as ws from gs
     where private.period_start('week', gs.today, gs.week_start) = gs.today
  )
  select d.id, d.name, d.ws,
         (select count(*)::int from public.check_ins c join public.habits h on h.id = c.habit_id
           where h.group_id = d.id and c.status = 'approved' and c.local_date >= d.ws and c.local_date < d.ws + 7),
         b.title, b.emoji, b.current_streak, b.period, b.template_id
    from due d
    left join lateral (
      select h.title, h.emoji, h.period, st.current_streak, h.template_id
        from public.habits h cross join lateral private.habit_streaks(h.id, p_now) st
       where h.group_id = d.id and h.archived_at is null and st.current_streak > 0
       order by st.current_streak desc, h.created_at
       limit 1) b on true;
$$;
create function public.family_recaps()
returns table (group_id uuid, group_name text, week_start date, check_ins int, best_title text, best_emoji text,
               best_streak int, best_period public.habit_period, best_template text)
language sql stable security definer set search_path = '' as $$
  select * from private.family_recaps_impl(auth.uid(), now());
$$;
revoke execute on function public.family_recaps() from public, anon;
grant execute on function public.family_recaps() to authenticated;
