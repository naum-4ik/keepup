-- Demo fixes (prod test D1). Try the demo → Progress → Recaps was empty: recaps_impl starts at
-- profiles.created_at, and a visitor signed up minutes ago although start_demo seeds 30 days. created_at
-- can't move back (cleanup_demo deletes demo profiles older than 24h by it), so a demo's recaps start with
-- its earliest habit instead. start_demo_impl: the treat goal and the waiting check-in are dated p_now
-- (were the real clock), so a run at a fixed p_now is deterministic (Nova's goal at 0 of 20).

create or replace function private.recaps_impl(p_user uuid, p_kind text, p_count int, p_now timestamptz)
returns setof jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_tz text;
  v_week_start smallint;
  v_first date;
  v_current date;
  v_from date;
  v_to date;
begin
  if p_kind is null or p_kind not in ('week', 'month') then
    raise exception 'keepup:invalid_choice' using errcode = 'P0001';
  end if;
  select p.timezone, p.week_start, private.local_date(p.created_at, p.timezone)
    into v_tz, v_week_start, v_first
    from public.profiles p where p.id = p_user;
  if not found then
    return;
  end if;
  -- A demo's history is seeded 30 days back while the visitor signed up minutes ago: its recaps start
  -- with its earliest habit. profiles.created_at stays the real sign-up time (cleanup_demo reads it).
  if (select p.is_demo from public.profiles p where p.id = p_user) then
    v_first := least(v_first, (select min(h.starts_on) from public.habits h where h.owner_id = p_user));
  end if;
  v_current := private.period_start(p_kind::public.habit_period, private.local_date(p_now, v_tz), v_week_start);
  for i in 1 .. least(greatest(coalesce(p_count, 8), 1), 26) loop
    v_from := case p_kind when 'week' then v_current - 7 * i else (v_current - make_interval(months => i))::date end;
    v_to := case p_kind when 'week' then v_from + 7 else (v_from + interval '1 month')::date end;
    exit when v_to <= v_first;
    return next private.recap_impl(p_user, p_kind, v_from, p_now);
  end loop;
end;
$$;

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
  insert into public.habits (owner_id, created_by, title, emoji, category, target_count, period, starts_on)
  values (p_user, p_user, 'Drink water', '💧', 'health', 1, 'day', v_today) returning id into v_water;
  insert into public.habits (owner_id, created_by, title, emoji, category, target_count, period, starts_on)
  values (p_user, p_user, 'Walk', '🚶', 'fitness', 3, 'week', v_today) returning id into v_walk;
  insert into public.habits (owner_id, created_by, title, emoji, category, target_count, period, starts_on)
  values (p_user, p_user, 'Meditate', '🧘', 'mind', 1, 'day', v_today) returning id into v_meditate;
  -- No children: the adults take part through membership (ADR 0012), not group_habit_participants.
  v_dinner := (private.create_group_habit_impl(p_user, v_group, 'Family dinner', '🍽️', 'people', 1, 'week', v_today, false, '{}', p_now)).id;
  v_together := (private.create_group_habit_impl(p_user, v_group, 'Walk together', '🚶', 'fitness', 2, 'week', v_today, true, '{}', p_now)).id;
  v_brush := (private.create_child_habit_impl(p_user, v_nova, 'Brush teeth', '🪥', 2, 'day', v_today)).id;
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
