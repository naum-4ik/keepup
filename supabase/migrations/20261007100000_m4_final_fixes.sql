-- M4 final review fixes. Every function replaced below is copied from its latest definition; only the
-- parts its comment names change. Sources:
--   private.kid_rewards_on_check_in  20261006100000_offline_check_ins.sql
--   private.resettle_period          20261006100000_offline_check_ins.sql
--   public.push_job                  20261005100000_group_pushes.sql
--
-- "The person who acted" is auth.uid(), as in feed_on_habit: group_adults ignores a null entry, so a
-- path without a signed-in user (cron, finalize, tests) excludes nobody.

-- Copied from 20261006100000_offline_check_ins.sql (its latest definition). New: a kid's big moments
-- (full garden, goal reached) go to the other adults, not to the one who made the tap (they are
-- looking at it in the kid view). A full garden is written once per kid and week: the tap that fills
-- it, so a later tap by someone else doesn't send it to the adult left out the first time.
create or replace function private.kid_rewards_on_check_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group uuid;
  v_week date;
  v_goal public.treat_goals;
  v_habit public.habits;
begin
  if new.status <> 'approved' then
    return new;
  end if;
  v_group := private.child_group(new.user_id);
  if v_group is null then
    return new; -- not a child
  end if;

  -- Serialize a child's concurrent check-ins so the one that crosses 18 sees all the others.
  perform 1 from public.profiles p where p.id = new.user_id for update;

  v_week := private.child_week_start(new.user_id, new.local_date);
  if private.child_stars(new.user_id, v_week, v_week + 7) >= 18
     and not exists (select 1 from public.notifications n
                      where n.dedupe_key = any (array(
                        select 'kid_garden_full:' || new.user_id || ':' || v_week || ':' || m.user_id
                          from public.group_members m where m.group_id = v_group))) then
    select h.* into v_habit from public.habits h where h.id = new.habit_id;
    perform private.notify(private.group_adults(v_group, array[auth.uid()]), 'kid_garden_full',
      'kid_garden_full:' || new.user_id || ':' || v_week, v_group, null, null, null, new.user_id,
      jsonb_build_object('week_start', v_week)
        || case when private.is_late_check_in(v_habit, new) then jsonb_build_object('late', true) else '{}'::jsonb end);
  end if;

  select g.* into v_goal from public.treat_goals g
   where g.child_id = new.user_id and g.received_at is null and g.reached_at is null
     for update;
  if found and (select count(*) from public.check_ins c
                 where c.user_id = new.user_id and c.status = 'approved' and c.created_at >= v_goal.created_at) >= v_goal.target then
    update public.treat_goals set reached_at = new.created_at where id = v_goal.id;
    perform private.notify(private.group_adults(v_group, array[auth.uid()]), 'kid_goal_reached', 'kid_goal_reached:' || v_goal.id,
      v_group, null, null, null, new.user_id, jsonb_build_object('title', v_goal.title, 'emoji', v_goal.emoji));
  end if;
  return new;
end;
$$;

-- Copied from 20261006100000_offline_check_ins.sql (its latest definition). New, for a group habit:
-- "streak is back" only follows an "ended" note that pushed (a streak of 3 or more, the same
-- null-safe read as push_allowed); a shorter one gets no streak_back row at all, as its "ended" line
-- was never pushed. And it never goes to the person whose tap or approval brought the streak back.
-- A private habit is unchanged (feed only, to its owner, who is always the one who tapped).
create or replace function private.resettle_period(p_habit public.habits, p_period_start date)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_old text;
  v_streak int;
begin
  select r.outcome into v_old from public.period_results r
   where r.habit_id = p_habit.id and r.period_start = p_period_start for update;
  if v_old is null or v_old not in ('missed', 'skipped') or private.period_outcome(p_habit, p_period_start) <> 'done' then
    return;
  end if;
  update public.period_results set outcome = 'done' where habit_id = p_habit.id and period_start = p_period_start;
  if v_old <> 'missed' then
    return;
  end if;
  -- The "ended" note is found by its exact dedupe keys (the unique index on dedupe_key): one per
  -- recipient, so for a group every member it may have reached, past members included.
  if p_habit.group_id is not null then
    select max(case when n.payload ->> 'streak' ~ '^\d{1,9}$' then (n.payload ->> 'streak')::int else 0 end) into v_streak
      from public.notifications n
     where n.dedupe_key = any (array(
       select 'group_streak_ended:' || p_habit.id || ':' || p_period_start || ':' || m.user_id
         from public.group_members m where m.group_id = p_habit.group_id));
    if v_streak >= 3 then
      perform private.notify(private.group_adults(p_habit.group_id, array[auth.uid()]), 'streak_back',
        'streak_back:' || p_habit.id || ':' || p_period_start, p_habit.group_id, p_habit.id, null, null, null,
        jsonb_build_object('period_start', p_period_start));
    end if;
  elsif exists (select 1 from public.notifications n
                 where n.dedupe_key = 'private_streak_ended:' || p_habit.id || ':' || p_period_start || ':' || p_habit.owner_id) then
    perform private.notify(array[p_habit.owner_id], 'streak_back',
      'streak_back:' || p_habit.id || ':' || p_period_start, null, p_habit.id, null, null, null,
      jsonb_build_object('period_start', p_period_start));
  end if;
end;
$$;

-- Copied from 20261005100000_group_pushes.sql (its latest definition). New: a group_check_in is
-- superseded only by an "Everyone did it" that pushes, for the same person, habit and period. A late
-- one (feed only) or yesterday's no longer silences today's check-ins.
create or replace function public.push_job(p_id uuid, p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.notifications n
               join public.check_ins c on c.id = n.check_in_id
              where n.id = p_id and n.push and n.kind = 'group_check_in'
                and exists (select 1 from public.notifications d
                             where d.kind = 'everyone_done' and d.user_id = n.user_id and d.habit_id = n.habit_id
                               and d.push
                               and d.payload @> jsonb_build_object('period_start', c.period_start)
                               and d.created_at >= n.created_at)) then
    update public.notifications set pushed_at = now() where id = p_id and pushed_at is null;
    return null;
  end if;
  return private.push_job_build(p_id, p_now);
end;
$$;
