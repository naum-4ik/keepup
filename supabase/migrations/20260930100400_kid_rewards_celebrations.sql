-- M3 kids' rewards (computed from check-ins; decision 10) and group celebrations data.

create function private.garden_stage(p_stars int)
returns int
language sql
immutable
set search_path = ''
as $$
  select case when p_stars >= 18 then 4 when p_stars >= 12 then 3 when p_stars >= 7 then 2 when p_stars >= 3 then 1 else 0 end;
$$;

create function private.child_stars(p_child_id uuid, p_from date, p_to date)
returns int
language sql
stable
set search_path = ''
as $$
  select count(*)::int from public.check_ins c
   where c.user_id = p_child_id and c.status = 'approved' and c.local_date >= p_from and c.local_date < p_to;
$$;

-- The child's week in her group's calendar.
create function private.child_week_start(p_child_id uuid, p_local_date date)
returns date
language sql
stable
set search_path = ''
as $$
  select private.period_start('week', p_local_date, g.week_start)
    from public.profiles c join public.groups g on g.id = c.group_id where c.id = p_child_id;
$$;

create function private.child_today(p_child_id uuid, p_now timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select private.local_date(p_now, g.timezone)
    from public.profiles c join public.groups g on g.id = c.group_id where c.id = p_child_id;
$$;

-- Goal reached (feed, and M4 push) and a full garden (once per child and week).
create function private.kid_rewards_on_check_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group uuid;
  v_week date;
  v_goal public.treat_goals;
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
  if private.child_stars(new.user_id, v_week, v_week + 7) >= 18 then
    perform private.notify(private.group_adults(v_group, null), 'kid_garden_full',
      'kid_garden_full:' || new.user_id || ':' || v_week, v_group, null, null, null, new.user_id,
      jsonb_build_object('week_start', v_week));
  end if;

  select g.* into v_goal from public.treat_goals g
   where g.child_id = new.user_id and g.received_at is null and g.reached_at is null
     for update;
  if found and (select count(*) from public.check_ins c
                 where c.user_id = new.user_id and c.status = 'approved' and c.created_at >= v_goal.created_at) >= v_goal.target then
    update public.treat_goals set reached_at = new.created_at where id = v_goal.id;
    perform private.notify(private.group_adults(v_group, null), 'kid_goal_reached', 'kid_goal_reached:' || v_goal.id,
      v_group, null, null, null, new.user_id, jsonb_build_object('title', v_goal.title, 'emoji', v_goal.emoji));
  end if;
  return new;
end;
$$;

create index check_ins_user_approved_idx on public.check_ins (user_id, local_date) where status = 'approved';

create trigger check_ins_kid_rewards after insert or update of status on public.check_ins
  for each row execute function private.kid_rewards_on_check_in();

create function private.child_rewards_impl(p_actor uuid, p_child_id uuid, p_now timestamptz)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_today date;
  v_week date;
  v_first date;
  v_stars int;
begin
  perform private.require_guardian(p_actor, p_child_id);
  v_today := private.child_today(p_child_id, p_now);
  v_week := private.child_week_start(p_child_id, v_today);
  v_first := private.child_week_start(p_child_id,
               private.local_date((select c.created_at from public.profiles c where c.id = p_child_id),
                                  (select g.timezone from public.profiles c join public.groups g on g.id = c.group_id where c.id = p_child_id)));
  v_stars := private.child_stars(p_child_id, v_week, v_week + 7);

  return jsonb_build_object(
    'week_start', v_week,
    'stars_this_week', v_stars,
    'stage', private.garden_stage(v_stars),
    'total_stars', (select count(*)::int from public.check_ins c where c.user_id = p_child_id and c.status = 'approved'),
    'album', coalesce((
      select jsonb_agg(jsonb_build_object('week_start', w.ws, 'stars', w.n, 'stage', private.garden_stage(w.n)) order by w.ws desc)
        from (select s.d::date as ws, private.child_stars(p_child_id, s.d::date, s.d::date + 7) as n
                from generate_series(greatest(v_first, v_week - 7 * 52)::timestamp, (v_week - 7)::timestamp, interval '7 days') s(d)) w),
      '[]'::jsonb),
    'goal', (select jsonb_build_object(
                'id', g.id, 'title', g.title, 'emoji', g.emoji, 'target', g.target, 'reached_at', g.reached_at,
                'stars', least(g.target, (select count(*)::int from public.check_ins c
                                            where c.user_id = p_child_id and c.status = 'approved' and c.created_at >= g.created_at)))
               from public.treat_goals g where g.child_id = p_child_id and g.received_at is null));
end;
$$;

-- Weekly family recap card (§7): shown on the first day of the group's week, about the week that
-- ended. Wins only: check-ins together and the longest current group streak.
create function private.family_recaps_impl(p_user uuid, p_now timestamptz)
returns table (group_id uuid, group_name text, week_start date, check_ins int, best_title text, best_emoji text,
               best_streak int, best_period public.habit_period)
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
         b.title, b.emoji, b.current_streak, b.period
    from due d
    left join lateral (
      select h.title, h.emoji, h.period, st.current_streak
        from public.habits h cross join lateral private.habit_streaks(h.id, p_now) st
       where h.group_id = d.id and h.archived_at is null and st.current_streak > 0
       order by st.current_streak desc, h.created_at
       limit 1) b on true;
$$;

-- Gentle Today cards and recap cards dismissed by a user (ideas/onboarding.md: dismiss state per user).
create table public.dismissed_cards (
  user_id uuid not null references public.profiles (id) on delete cascade,
  card text not null check (char_length(card) between 1 and 120),
  dismissed_at timestamptz not null default now(),
  primary key (user_id, card)
);

alter table public.dismissed_cards enable row level security;
create policy "dismissed_cards: read own" on public.dismissed_cards
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.dismissed_cards from anon, authenticated;
grant select on public.dismissed_cards to authenticated;

create function public.dismiss_card(p_card text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uuid constant text := '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  if p_card is null or p_card !~ ('^(invite_family|invite_friend|add_child:' || v_uuid || '|family_recap:' || v_uuid || ':[0-9]{4}-[0-9]{2}-[0-9]{2})$') then
    raise exception 'keepup:invalid_card' using errcode = 'P0001';
  end if;
  insert into public.dismissed_cards (user_id, card) values (auth.uid(), p_card) on conflict do nothing;
end;
$$;

create function public.child_rewards(p_child_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return private.child_rewards_impl(auth.uid(), p_child_id, now());
end;
$$;

create function public.family_recaps()
returns table (group_id uuid, group_name text, week_start date, check_ins int, best_title text, best_emoji text,
               best_streak int, best_period public.habit_period)
language sql stable security definer set search_path = '' as $$
  select * from private.family_recaps_impl(auth.uid(), now());
$$;

revoke execute on function public.dismiss_card(text), public.child_rewards(uuid), public.family_recaps() from public, anon;
grant execute on function public.dismiss_card(text), public.child_rewards(uuid), public.family_recaps() to authenticated;

-- Deadlock fix: lock order is habit row, then check-in row, everywhere. undo_check_in_impl locks the
-- habit then deletes the check-in, and the feed trigger locks the habit after the check-in update, so
-- review (check-in first, habit second) could deadlock against undo. Same body otherwise.
create or replace function private.review_check_in_impl(p_check_in_id uuid, p_actor uuid, p_approve boolean, p_now timestamptz)
returns public.check_ins
language plpgsql
set search_path = ''
as $$
declare
  v_check_in public.check_ins;
  v_habit public.habits;
  v_habit_id uuid;
begin
  select c.habit_id into v_habit_id from public.check_ins c where c.id = p_check_in_id;
  if not found then
    raise exception 'keepup:check_in_not_found' using errcode = 'P0002';
  end if;
  perform 1 from public.habits h where h.id = v_habit_id for update;

  select c.* into v_check_in from public.check_ins c where c.id = p_check_in_id for update;
  if not found then
    raise exception 'keepup:check_in_not_found' using errcode = 'P0002';
  end if;
  select h.* into v_habit from public.habits h where h.id = v_check_in.habit_id;
  if v_habit.group_id is null or not private.is_member(v_habit.group_id, p_actor) then
    raise exception 'keepup:check_in_not_found' using errcode = 'P0002';
  end if;
  if v_check_in.user_id = p_actor then
    raise exception 'keepup:own_check_in' using errcode = 'P0001';
  end if;
  if v_check_in.status <> 'pending' then
    raise exception 'keepup:already_reviewed' using errcode = 'P0001';
  end if;
  if p_now >= private.review_deadline(v_habit, v_check_in.period_start) then
    raise exception 'keepup:review_closed' using errcode = 'P0001';
  end if;

  update public.check_ins
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = p_actor, reviewed_at = p_now
   where id = p_check_in_id
  returning * into v_check_in;
  return v_check_in;
end;
$$;

-- "Approve all": reviews what it can; ones someone else just reviewed, whose window closed, or that
-- were undone meanwhile are skipped, not errors. Returns how many this call reviewed. Every review
-- locks the habit row first, so ids are taken ordered by (habit_id, id): two reviewers approving
-- overlapping sets then lock habits in the same order and can't deadlock. Ids not found sort last
-- and are skipped as check_in_not_found.
create or replace function public.review_check_ins(p_check_in_ids uuid[], p_approve boolean)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_done int := 0;
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  for v_id in
    select x.id
      from (select distinct u.id from unnest(coalesce(p_check_in_ids, '{}')) u(id) where u.id is not null) x
      left join public.check_ins c on c.id = x.id
     order by c.habit_id nulls last, x.id
  loop
    begin
      perform private.review_check_in_impl(v_id, auth.uid(), p_approve, now());
      v_done := v_done + 1;
    exception
      when sqlstate 'P0001' then
        if sqlerrm not in ('keepup:already_reviewed', 'keepup:review_closed') then raise; end if;
      when sqlstate 'P0002' then
        if sqlerrm <> 'keepup:check_in_not_found' then raise; end if;
    end;
  end loop;
  return v_done;
end;
$$;

revoke execute on function public.review_check_ins(uuid[], boolean) from public, anon;
grant execute on function public.review_check_ins(uuid[], boolean) to authenticated;
