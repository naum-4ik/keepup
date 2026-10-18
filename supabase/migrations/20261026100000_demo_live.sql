-- The demo looks live on any day, in the visitor's language (owner, 2026-10-18).
--   * Template-linked titles: Read 20 min ('read'), Family walk ('g-family-walk'), Read a book together
--     ('kid.read-together'), Tidy my toys ('kid.tidy-toys'), so they show in each viewer's language.
--   * Nova is a girl (gendered ru/he kid copy).
--   * The group and the treat are named in the visitor's language: start_demo takes them from the app
--     (en defaults keep the old call working; the treat is the catalog's "Trip to the playground").
--   * Nova's week: every slot on every elapsed day of this week, none today (something to tap).
--   * The Inbox: a nudge and a cheer from Alex, a few hours old.
--
-- Replaced functions are copied from their latest definitions; only the above changes:
--   private.start_demo_impl   20261024100000_habit_template_id.sql
--   public.start_demo         20261018100000_demo_mode.sql
-- New params go last (drop + create), so positional callers of the impl keep working.

drop function public.start_demo(text);
drop function private.start_demo_impl(uuid, text, timestamptz);

create function private.start_demo_impl(p_user uuid, p_timezone text, p_now timestamptz,
  p_group_name text default 'Family', p_treat_title text default 'Trip to the playground')
returns void language plpgsql set search_path = '' as $$
declare
  v_tz text := case when public.is_valid_timezone(coalesce(p_timezone, '')) then p_timezone else 'UTC' end;
  v_today date := (p_now at time zone v_tz)::date;
  v_week date := private.period_start('week', (p_now at time zone v_tz)::date, 1::smallint);
  -- A name the tables would refuse (blank, too long) falls back to English rather than failing the demo.
  v_group_name text := coalesce(nullif(left(btrim(coalesce(p_group_name, ''), E' \t\n\r' || chr(160)), 40), ''), 'Family');
  v_treat_title text := coalesce(nullif(left(btrim(coalesce(p_treat_title, ''), E' \t\n\r' || chr(160)), 40), ''), 'Trip to the playground');
  v_alex uuid := gen_random_uuid();
  v_profile public.profiles;
  v_group uuid; v_nova uuid;
  v_read uuid; v_water uuid; v_walk uuid; v_meditate uuid;
  v_dinner uuid; v_together uuid; v_brush uuid; v_story uuid; v_tidy uuid;
  v_seeded uuid[];
  v_habit public.habits;
  v_ps date;
  v_nudged_at timestamptz; v_cheered_at timestamptz; v_cheered uuid;
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
  v_group := (private.create_group_impl(p_user, v_group_name, 'family')).id;
  insert into public.group_members (group_id, user_id, role) values (v_group, v_alex, 'member');
  v_nova := private.create_child_impl(p_user, v_group, 'Nova', '🐼', 'sage', true);
  perform private.set_child_gender_impl(p_user, v_nova, 'girl');

  -- 2. Habits, starting today (the rules allow no past start); backdated in step 3.
  insert into public.habits (owner_id, created_by, title, emoji, category, target_count, period, starts_on, template_id)
  values (p_user, p_user, 'Read 20 min', '📚', 'learning', 1, 'day', v_today, 'read') returning id into v_read;
  insert into public.habits (owner_id, created_by, title, emoji, category, target_count, period, starts_on, template_id)
  values (p_user, p_user, 'Drink water', '💧', 'health', 1, 'day', v_today, 'water') returning id into v_water;
  insert into public.habits (owner_id, created_by, title, emoji, category, target_count, period, starts_on)
  values (p_user, p_user, 'Walk', '🚶', 'fitness', 3, 'week', v_today) returning id into v_walk;
  insert into public.habits (owner_id, created_by, title, emoji, category, target_count, period, starts_on, template_id)
  values (p_user, p_user, 'Meditate', '🧘', 'mind', 1, 'day', v_today, 'meditate') returning id into v_meditate;
  -- No children: the adults take part through membership (ADR 0012), not group_habit_participants.
  v_dinner := (private.create_group_habit_impl(p_user, v_group, 'Family dinner', '🍽️', 'people', 1, 'week', v_today, false, '{}', p_now, 'g-family-dinner')).id;
  v_together := (private.create_group_habit_impl(p_user, v_group, 'Family walk', '🚶', 'fitness', 2, 'week', v_today, true, '{}', p_now, 'g-family-walk')).id;
  v_brush := (private.create_child_habit_impl(p_user, v_nova, 'Brush teeth', '🪥', 2, 'day', v_today, 'kid.brush-teeth')).id;
  v_story := (private.create_child_habit_impl(p_user, v_nova, 'Read a book together', '📖', 1, 'day', v_today, 'kid.read-together')).id;
  v_tidy := (private.create_child_habit_impl(p_user, v_nova, 'Tidy my toys', '🧸', 1, 'day', v_today, 'kid.tidy-toys')).id;
  perform private.set_treat_goal_impl(p_user, v_nova, v_treat_title, '🛝', 20);
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

  -- 3c. Nova: every slot last week, and every slot of each elapsed day this week (local days before
  -- today; none on a Monday), logged by Sam at 08:00. Today stays open, so the visitor has something to
  -- tap; every star is before now, so none counts toward the new treat goal.
  insert into public.check_ins (habit_id, user_id, local_date, period_start, status, created_at, logged_by)
  select h.id, v_nova, d::date, d::date, 'approved', (d::date + time '08:00') at time zone v_tz, p_user
    from public.habits h
   cross join generate_series((v_week - 7)::timestamp, (v_today - 1)::timestamp, interval '1 day') d
   cross join lateral generate_series(1, h.target_count::int) n
   where h.id in (v_brush, v_story, v_tidy);

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

  -- 3e. Alex's nudge and cheer, as nudge_impl / cheer_impl write them (the feed rows follow in step 4a).
  -- Triggers off: a cheer's insert trigger would award Alex a badge. The nudge is on Family walk (Sam
  -- has none this week), 3 hours ago but not before today; the cheer is on Sam's latest group check-in
  -- (always last week or earlier, so before the cheer).
  v_nudged_at := least(greatest(p_now - interval '3 hours', v_today::timestamp at time zone v_tz), p_now);
  v_cheered_at := p_now - interval '5 hours';
  insert into public.nudges (sender_id, recipient_id, habit_id, local_date, kind, created_at)
  values (v_alex, p_user, v_together, (v_nudged_at at time zone v_tz)::date, 'you_got_this', v_nudged_at);
  select c.id into v_cheered from public.check_ins c
   where c.user_id = p_user and c.habit_id in (v_dinner, v_together) and c.status = 'approved'
   order by c.created_at desc, c.id limit 1;
  insert into public.cheers (check_in_id, user_id, created_at) values (v_cheered, v_alex, v_cheered_at);
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

  -- 4a. The nudge and the cheer in Sam's Inbox, after the cleanup above. Built by private.notify with the
  -- same kind, dedupe key and payload as nudge_impl / cheer_impl, then dated and kept from pushing.
  perform private.notify(array[p_user], 'nudge', 'nudge:' || v_alex || ':' || v_together || ':' || (v_nudged_at at time zone v_tz)::date,
    v_group, v_together, null, v_alex, null, jsonb_build_object('kind', 'you_got_this'));
  perform private.notify(array[p_user], 'cheer', 'cheer:' || v_cheered || ':' || v_alex,
    v_group, (select c.habit_id from public.check_ins c where c.id = v_cheered), v_cheered, v_alex, null, '{}'::jsonb);
  update public.notifications
     set created_at = case kind when 'nudge' then v_nudged_at else v_cheered_at end, push = false
   where user_id = p_user and kind in ('nudge', 'cheer');

  -- 5. Today, triggers on: Alex's walk waits for Sam (an Inbox row appears).
  insert into public.check_ins (habit_id, user_id, local_date, period_start, status, logged_by, created_at)
  values (v_together, v_alex, v_today, v_week, 'pending', v_alex, p_now);
end;
$$;
revoke execute on function private.start_demo_impl(uuid, text, timestamptz, text, text) from public, anon, authenticated;

create function public.start_demo(p_timezone text, p_group_name text default 'Family',
  p_treat_title text default 'Trip to the playground')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'keepup:not_authenticated' using errcode = '42501';
  end if;
  perform private.start_demo_impl(auth.uid(), p_timezone, now(), p_group_name, p_treat_title);
end; $$;
revoke execute on function public.start_demo(text, text, text) from public, anon;
grant execute on function public.start_demo(text, text, text) to authenticated;
