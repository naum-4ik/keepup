-- M3 group habits: a habit is owned by a person (private, or a child's) or by a group. Adults always
-- take part in their group's habits; children opt in (group_habit_participants). Approval habits keep
-- a closed period open for reviews until 12h after it ends.

-- 1. Habits
alter table public.habits
  alter column owner_id drop not null,
  add column group_id uuid references public.groups (id) on delete cascade,
  add column requires_approval boolean not null default false,
  add column created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  add constraint habits_owner_or_group_check check (num_nonnulls(owner_id, group_id) = 1),
  add constraint habits_approval_group_check check (not requires_approval or group_id is not null);

create index habits_group_active_idx on public.habits (group_id) where archived_at is null;
update public.habits set created_by = owner_id where created_by is null;

-- Children who take part in a group habit (decision 1). Chosen at creation, never changed.
create table public.group_habit_participants (
  habit_id uuid not null references public.habits (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (habit_id, profile_id)
);

-- 2. Member pauses: user_id null = the whole habit (existing rows), else that member only.
alter table public.habit_freezes
  add column user_id uuid references public.profiles (id) on delete cascade,
  add column created_by uuid references public.profiles (id) on delete set null;
create index habit_freezes_member_idx on public.habit_freezes (habit_id, user_id) where user_id is not null;

-- 3. Check-ins: who logged it (null = a child's own tap in the kid view) and the review.
alter table public.check_ins
  add column logged_by uuid references public.profiles (id) on delete set null,
  add column reviewed_by uuid references public.profiles (id) on delete set null,
  add column reviewed_at timestamptz,
  add constraint check_ins_no_self_review check (reviewed_by is null or reviewed_by <> user_id);
update public.check_ins set logged_by = user_id where logged_by is null;
create index check_ins_pending_idx on public.check_ins (habit_id) where status = 'pending';

-- 4. The habit's calendar. A group habit uses its group's time zone; a child's habit its group's
-- (profiles.group_id is set only for children); a private habit its owner's.
create function private.habit_timezone(p_habit public.habits)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select g.timezone from public.groups g where g.id = p_habit.group_id),
    (select coalesce(g.timezone, p.timezone)
       from public.profiles p left join public.groups g on g.id = p.group_id
      where p.id = p_habit.owner_id));
$$;

create or replace function private.habit_today(p_habit public.habits, p_now timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select private.local_date(p_now, private.habit_timezone(p_habit));
$$;

-- Same as 20260929140000, plus: the calendar comes from private.habit_timezone and the week start
-- from the group (group habits and children's habits); a missing category is only allowed for a
-- child's own habit (kid templates have none), whose default emoji is ⭐.
create or replace function private.habit_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date;
begin
  v_today := private.habit_today(new, now());

  if tg_op = 'INSERT' then
    new.starts_on := coalesce(new.starts_on, v_today);
    new.week_start := coalesce(
      (select g.week_start from public.groups g where g.id = new.group_id),
      (select coalesce(g.week_start, p.week_start)
         from public.profiles p left join public.groups g on g.id = p.group_id
        where p.id = new.owner_id));
    new.emoji := coalesce(nullif(btrim(new.emoji), ''), private.default_emoji(new.category), '⭐');
  end if;

  if new.category is null and not exists (
    select 1 from public.profiles p where p.id = new.owner_id and p.kind = 'child') then
    raise exception 'keepup:category_required' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' or new.starts_on is distinct from old.starts_on then
    if tg_op = 'UPDATE' and exists (select 1 from public.check_ins c where c.habit_id = new.id) then
      raise exception 'keepup:start_locked' using errcode = 'P0001';
    end if;
    if new.starts_on < v_today then
      raise exception 'keepup:start_in_past' using errcode = 'P0001';
    end if;
    if new.starts_on > v_today + 365 then
      raise exception 'keepup:start_too_far' using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.archived_at is distinct from old.archived_at then
    new.archived_at := coalesce(old.archived_at, now());
  end if;
  return new;
end;
$$;

-- 5. Access
-- How p_user relates to a habit. 'owner': their private habit. 'guardian': a habit of a child in a
-- group they are a current member of. 'admin'/'member': a habit of a group they are in. null: none.
create function private.habit_role(p_habit public.habits, p_user uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_habit.owner_id = p_user then 'owner'
    when p_habit.group_id is not null then
      (select m.role from public.group_members m
        where m.group_id = p_habit.group_id and m.user_id = p_user and m.left_at is null)
    else
      (select 'guardian' from public.profiles c
         join public.group_members m on m.group_id = c.group_id and m.user_id = p_user and m.left_at is null
        where c.id = p_habit.owner_id and c.kind = 'child')
  end;
$$;

-- p_actor may act as p_profile: it's themselves, or a child in a group p_actor is a current member of.
-- coalesce: never null (a null p_profile must read as "no").
create function private.can_act_for(p_actor uuid, p_profile uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(p_actor = p_profile, false) or exists (
    select 1 from public.profiles c
      join public.group_members m on m.group_id = c.group_id and m.user_id = p_actor and m.left_at is null
     where c.id = p_profile and c.kind = 'child');
$$;

-- p_profile takes part in the habit today: its owner, a current adult member, or an included child
-- still in the habit's group.
create function private.takes_part(p_habit public.habits, p_profile uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  -- coalesce: on a group habit owner_id is null, and "null = x OR false" is null, which a caller's
  -- "if not takes_part(...)" would silently treat as allowed.
  select coalesce(
    p_habit.owner_id = p_profile
    or (p_habit.group_id is not null and (
          private.is_member(p_habit.group_id, p_profile)
          or exists (select 1 from public.group_habit_participants gp
                       join public.profiles c on c.id = gp.profile_id
                      where gp.habit_id = p_habit.id and gp.profile_id = p_profile and c.group_id = p_habit.group_id))),
    false);
$$;

create function public.can_read_habit(p_habit_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.habits h where h.id = p_habit_id and private.habit_role(h, auth.uid()) is not null);
$$;

-- Edit title/emoji/category/start/archive: the owner, a group admin, or any adult for a child's habit.
create function public.can_manage_habit(p_habit_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.habits h
                  where h.id = p_habit_id and private.habit_role(h, auth.uid()) in ('owner', 'admin', 'guardian'));
$$;

create function public.can_act_for_profile(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_act_for(auth.uid(), p_profile_id);
$$;

revoke execute on function public.can_read_habit(uuid), public.can_manage_habit(uuid), public.can_act_for_profile(uuid) from public, anon;
grant execute on function public.can_read_habit(uuid), public.can_manage_habit(uuid), public.can_act_for_profile(uuid) to authenticated;

create policy "habits: read shared" on public.habits
  for select to authenticated using (public.can_read_habit(id));
create policy "habits: update shared" on public.habits
  for update to authenticated using (public.can_manage_habit(id)) with check (public.can_manage_habit(id));
create policy "check_ins: read shared" on public.check_ins
  for select to authenticated using (public.can_read_habit(habit_id));
create policy "habit_freezes: read shared" on public.habit_freezes
  for select to authenticated using (public.can_read_habit(habit_id));
create policy "period_results: read shared" on public.period_results
  for select to authenticated using (public.can_read_habit(habit_id));

alter table public.group_habit_participants enable row level security;
create policy "group_habit_participants: read shared" on public.group_habit_participants
  for select to authenticated using (public.can_read_habit(habit_id));
revoke all on public.group_habit_participants from anon, authenticated;
grant select on public.group_habit_participants to authenticated;

-- 6. Pauses. The whole-habit test ignores member pauses.
create or replace function private.is_frozen(p_habit_id uuid, p_start date, p_end date)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.habit_freezes f
     where f.habit_id = p_habit_id and f.user_id is null
       and f.starts_on < p_end
       and coalesce(f.ends_on, 'infinity'::date) >= p_start
  );
$$;

create function private.is_member_frozen(p_habit_id uuid, p_profile_id uuid, p_start date, p_end date)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.habit_freezes f
     where f.habit_id = p_habit_id and f.user_id = p_profile_id
       and f.starts_on < p_end
       and coalesce(f.ends_on, 'infinity'::date) >= p_start
  );
$$;

-- 7. Required members (spec + decision 2). The effective start is the later of the period start and
-- the habit's creation, so the people there on day one count in the first period.
create function private.required_members(p_habit public.habits, p_start date)
returns setof uuid
language sql
stable
set search_path = ''
as $$
  with b as (
    select greatest(private.local_midnight(p_start, private.habit_timezone(p_habit)), p_habit.created_at) as s,
           private.local_midnight(private.period_end(p_habit.period, p_start), private.habit_timezone(p_habit)) as e,
           private.period_end(p_habit.period, p_start) as end_date
  )
  select m.user_id
    from public.group_members m cross join b
   where m.group_id = p_habit.group_id
     and m.joined_at <= b.s
     and (m.left_at is null or m.left_at >= b.e)
     and not private.is_member_frozen(p_habit.id, m.user_id, p_start, b.end_date)
  union
  select gp.profile_id
    from public.group_habit_participants gp
    join public.profiles c on c.id = gp.profile_id
   cross join b
   where gp.habit_id = p_habit.id
     and c.group_id = p_habit.group_id
     and not private.is_member_frozen(p_habit.id, gp.profile_id, p_start, b.end_date);
$$;

-- 8. Outcome. Private habits: unchanged (20260929120000). Group habits: done when every required
-- member has target_count approved check-ins; skipped when nobody is required.
create or replace function private.period_outcome(p_habit public.habits, p_period_start date)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_done int;
  v_required int;
  v_short int;
begin
  if p_habit.group_id is null then
    select count(*) into v_done from public.check_ins c
     where c.habit_id = p_habit.id and c.period_start = p_period_start and c.status = 'approved';
    if v_done >= p_habit.target_count then
      return 'done';
    end if;
  else
    select count(*), count(*) filter (where n.cnt < p_habit.target_count)
      into v_required, v_short
      from private.required_members(p_habit, p_period_start) r(profile_id)
      cross join lateral (
        select count(*)::int as cnt from public.check_ins c
         where c.habit_id = p_habit.id and c.user_id = r.profile_id
           and c.period_start = p_period_start and c.status = 'approved') n;
    if v_required = 0 then
      return 'skipped';
    end if;
    if v_short = 0 then
      return 'done';
    end if;
  end if;
  if private.is_frozen(p_habit.id, p_period_start, private.period_end(p_habit.period, p_period_start)) then
    return 'skipped';
  end if;
  if p_period_start = private.first_period_start(p_habit) then
    return 'skipped';
  end if;
  return 'missed';
end;
$$;

-- 9. The review window (decision 3; spec: period end + 12h).
create function private.review_deadline(p_habit public.habits, p_period_start date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select private.local_midnight(private.period_end(p_habit.period, p_period_start), private.habit_timezone(p_habit))
         + interval '12 hours';
$$;

create function private.in_grace(p_habit public.habits, p_period_start date, p_now timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_habit.requires_approval and p_now < private.review_deadline(p_habit, p_period_start);
$$;

-- Same as 20260929100400, plus: a closed period still in grace waits; pending check-ins of the
-- periods being finalized become expired first.
create or replace function private.finalize_periods(p_now timestamptz)
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_habit public.habits;
  v_step interval;
  v_current date;
  v_last date;
  v_inserted int;
  v_total int := 0;
begin
  for v_habit in select h.* from public.habits h where h.archived_at is null loop
    v_step := private.period_step(v_habit.period);
    v_current := private.habit_period_start(v_habit, private.habit_today(v_habit, p_now));
    v_last := (v_current::timestamp - v_step)::date;
    -- Periods are at least a day long, so only the one just closed can still be in its 12h grace.
    if private.in_grace(v_habit, v_last, p_now) then
      v_last := (v_last::timestamp - v_step)::date;
    end if;

    update public.check_ins c set status = 'expired'
     where c.habit_id = v_habit.id and c.status = 'pending' and c.period_start <= v_last;

    insert into public.period_results (habit_id, period_start, outcome, finalized_at)
    select v_habit.id, s.d::date, private.period_outcome(v_habit, s.d::date), p_now
      from generate_series(private.first_period_start(v_habit)::timestamp, v_last::timestamp, v_step) as s(d)
     where not exists (
       select 1 from public.period_results x where x.habit_id = v_habit.id and x.period_start = s.d::date)
    on conflict (habit_id, period_start) do nothing;

    get diagnostics v_inserted = row_count;
    v_total := v_total + v_inserted;
  end loop;
  return v_total;
end;
$$;

-- Same as 20260929100500, plus: a closed period in grace that isn't done yet counts as open (neither
-- adds nor breaks the streak).
create or replace function private.habit_streaks(p_habit_id uuid, p_now timestamptz)
returns table (current_streak int, best_streak int)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_habit public.habits;
  v_step interval;
  v_current date;
  v_run int := 0;
  v_best int := 0;
  v_outcome text;
  r record;
begin
  select h.* into v_habit from public.habits h where h.id = p_habit_id;
  if not found then
    current_streak := 0;
    best_streak := 0;
    return next;
    return;
  end if;
  v_step := private.period_step(v_habit.period);
  v_current := private.habit_period_start(v_habit, private.habit_last_date(v_habit, p_now));

  for r in
    select s.d::date as ps
      from generate_series(private.first_period_start(v_habit)::timestamp, v_current::timestamp - v_step, v_step) as s(d)
     order by 1
  loop
    v_outcome := null;
    select x.outcome into v_outcome from public.period_results x
     where x.habit_id = p_habit_id and x.period_start = r.ps;
    if v_outcome is null then
      v_outcome := private.period_outcome(v_habit, r.ps);
      if v_outcome <> 'done' and private.in_grace(v_habit, r.ps, p_now) then
        v_outcome := 'open';
      end if;
    end if;
    if v_outcome = 'done' then
      v_run := v_run + 1;
      v_best := greatest(v_best, v_run);
    elsif v_outcome = 'missed' then
      v_run := 0;
    end if;
  end loop;

  if v_current >= private.first_period_start(v_habit)
     and private.period_outcome(v_habit, v_current) = 'done' then
    v_run := v_run + 1;
    v_best := greatest(v_best, v_run);
  end if;

  current_streak := v_run;
  best_streak := v_best;
  return next;
end;
$$;

-- Same as 20260929100500, plus: access by role (group members, guardians), and the grace rule.
create or replace function private.habit_history(p_habit_id uuid, p_user_id uuid, p_now timestamptz, p_limit int)
returns table (period_start date, outcome text)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_habit public.habits;
  v_step interval;
  v_current date;
  v_from date;
begin
  select h.* into v_habit from public.habits h where h.id = p_habit_id;
  if not found or private.habit_role(v_habit, p_user_id) is null then
    return;
  end if;
  v_step := private.period_step(v_habit.period);
  v_current := private.habit_period_start(v_habit, private.habit_last_date(v_habit, p_now));
  v_from := greatest(private.first_period_start(v_habit),
                     (v_current::timestamp - v_step * (greatest(p_limit, 1) - 1))::date);

  return query
    select s.d::date,
           case
             when s.d::date = v_current then
               case
                 when private.period_outcome(v_habit, v_current) = 'done' then 'done'
                 when private.is_frozen(v_habit.id, v_current, private.period_end(v_habit.period, v_current)) then 'skipped'
                 else 'open'
               end
             else coalesce(
               (select x.outcome from public.period_results x
                 where x.habit_id = v_habit.id and x.period_start = s.d::date),
               case
                 when private.period_outcome(v_habit, s.d::date) <> 'done' and private.in_grace(v_habit, s.d::date, p_now) then 'open'
                 else private.period_outcome(v_habit, s.d::date)
               end)
           end
      from generate_series(v_from::timestamp, v_current::timestamp, v_step) as s(d)
     order by 1;
end;
$$;

-- 10. Check-ins. p_subject: who the check-in is for (default the actor); an adult may check in for a
-- child of their group. p_by_child: a tap in the kid view (logged_by null).
drop function private.check_in_impl(uuid, uuid, timestamptz);

create function private.check_in_impl(
  p_habit_id uuid, p_actor uuid, p_now timestamptz, p_subject uuid default null, p_by_child boolean default false)
returns public.check_ins
language plpgsql
set search_path = ''
as $$
declare
  v_subject uuid := coalesce(p_subject, p_actor);
  v_kind text;
  v_habit public.habits;
  v_today date;
  v_start date;
  v_count int;
  v_status text := 'approved';
  v_row public.check_ins;
begin
  if not private.can_act_for(p_actor, v_subject) then
    raise exception 'keepup:habit_not_found' using errcode = 'P0002';
  end if;
  select p.kind into v_kind from public.profiles p where p.id = v_subject;
  if p_by_child and v_kind is distinct from 'child' then
    raise exception 'keepup:not_a_child' using errcode = 'P0001';
  end if;

  -- The row lock serialises concurrent check-ins on this habit (a double tap, two parents at once).
  select h.* into v_habit from public.habits h where h.id = p_habit_id for update;
  if not found or not private.takes_part(v_habit, v_subject) then
    raise exception 'keepup:habit_not_found' using errcode = 'P0002';
  end if;
  if v_habit.archived_at is not null then
    raise exception 'keepup:habit_archived' using errcode = 'P0001';
  end if;

  v_today := private.habit_today(v_habit, p_now);
  if v_today < v_habit.starts_on then
    raise exception 'keepup:habit_not_started' using errcode = 'P0001';
  end if;
  v_start := private.habit_period_start(v_habit, v_today);

  if exists (select 1 from public.period_results r where r.habit_id = p_habit_id and r.period_start = v_start) then
    raise exception 'keepup:period_closed' using errcode = 'P0001';
  end if;

  if private.is_frozen(p_habit_id, v_today, v_today + 1)
     or private.is_member_frozen(p_habit_id, v_subject, v_today, v_today + 1) then
    raise exception 'keepup:habit_frozen' using errcode = 'P0001';
  end if;

  select count(*) into v_count from public.check_ins c
   where c.habit_id = p_habit_id and c.user_id = v_subject
     and c.period_start = v_start and c.status <> 'rejected';
  if v_count >= v_habit.target_count then
    raise exception 'keepup:target_reached' using errcode = 'P0001';
  end if;

  if v_habit.period <> 'day' and exists (
    select 1 from public.check_ins c
     where c.habit_id = p_habit_id and c.user_id = v_subject
       and c.local_date = v_today and c.status <> 'rejected'
  ) then
    raise exception 'keepup:already_checked_in_today' using errcode = 'P0001';
  end if;

  -- Approval applies to an adult's own part only (a child's part never waits), and only when the
  -- group had at least two adults at the period's (effective) start (spec: Check-ins).
  if v_habit.requires_approval and v_kind = 'adult' and (
       select count(*) from public.group_members m
        where m.group_id = v_habit.group_id
          and m.joined_at <= greatest(private.local_midnight(v_start, private.habit_timezone(v_habit)), v_habit.created_at)
          and (m.left_at is null or m.left_at > greatest(private.local_midnight(v_start, private.habit_timezone(v_habit)), v_habit.created_at))
     ) >= 2 then
    v_status := 'pending';
  end if;

  insert into public.check_ins (habit_id, user_id, local_date, period_start, created_at, status, logged_by)
  values (p_habit_id, v_subject, v_today, v_start, p_now, v_status, case when p_by_child then null else p_actor end)
  returning * into v_row;
  return v_row;
end;
$$;

-- The author, or any adult of the group for a child's check-in, may undo while the period is open.
create or replace function private.undo_check_in_impl(p_check_in_id uuid, p_user_id uuid, p_now timestamptz)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_check_in public.check_ins;
  v_habit public.habits;
begin
  select c.* into v_check_in from public.check_ins c where c.id = p_check_in_id;
  if not found or not private.can_act_for(p_user_id, v_check_in.user_id) then
    raise exception 'keepup:check_in_not_found' using errcode = 'P0002';
  end if;

  select h.* into v_habit from public.habits h where h.id = v_check_in.habit_id for update;
  if v_check_in.period_start <> private.habit_period_start(v_habit, private.habit_today(v_habit, p_now)) then
    raise exception 'keepup:period_closed' using errcode = 'P0001';
  end if;

  delete from public.check_ins where id = p_check_in_id;
end;
$$;

-- Any current adult member other than the author reviews a pending check-in until the deadline.
-- The row lock makes the first review win.
create function private.review_check_in_impl(p_check_in_id uuid, p_actor uuid, p_approve boolean, p_now timestamptz)
returns public.check_ins
language plpgsql
set search_path = ''
as $$
declare
  v_check_in public.check_ins;
  v_habit public.habits;
begin
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

-- 11. Pauses by role: whole habit by the owner, a group admin or a child's adult; a member pause by
-- the member (or an adult for a child).
create or replace function private.freeze_habit_impl(
  p_habit_id uuid, p_user_id uuid, p_starts_on date, p_ends_on date, p_now timestamptz)
returns public.habit_freezes
language plpgsql
set search_path = ''
as $$
declare
  v_habit public.habits;
  v_start date;
  v_row public.habit_freezes;
begin
  select h.* into v_habit from public.habits h where h.id = p_habit_id and h.archived_at is null for update;
  if not found or private.habit_role(v_habit, p_user_id) not in ('owner', 'admin', 'guardian')
     or private.habit_role(v_habit, p_user_id) is null then
    raise exception 'keepup:habit_not_found' using errcode = 'P0002';
  end if;

  v_start := coalesce(p_starts_on, private.habit_today(v_habit, p_now));
  if v_start < private.habit_today(v_habit, p_now) then
    raise exception 'keepup:freeze_in_past' using errcode = 'P0001';
  end if;
  if p_ends_on is not null and p_ends_on < v_start then
    raise exception 'keepup:freeze_range_invalid' using errcode = 'P0001';
  end if;
  if private.is_frozen(p_habit_id, v_start, coalesce(p_ends_on + 1, 'infinity'::date)) then
    raise exception 'keepup:freeze_overlaps' using errcode = 'P0001';
  end if;

  insert into public.habit_freezes (habit_id, starts_on, ends_on, created_by)
  values (p_habit_id, v_start, p_ends_on, p_user_id)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function private.unfreeze_habit_impl(p_habit_id uuid, p_user_id uuid, p_now timestamptz)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_habit public.habits;
  v_today date;
begin
  select h.* into v_habit from public.habits h where h.id = p_habit_id for update;
  if not found or coalesce(private.habit_role(v_habit, p_user_id), '') not in ('owner', 'admin', 'guardian') then
    raise exception 'keepup:habit_not_found' using errcode = 'P0002';
  end if;

  v_today := private.habit_today(v_habit, p_now);
  delete from public.habit_freezes where habit_id = p_habit_id and user_id is null and starts_on >= v_today;
  update public.habit_freezes set ends_on = v_today - 1
   where habit_id = p_habit_id and user_id is null and starts_on < v_today and (ends_on is null or ends_on >= v_today);
end;
$$;

create function private.freeze_member_impl(
  p_habit_id uuid, p_actor uuid, p_profile_id uuid, p_starts_on date, p_ends_on date, p_now timestamptz)
returns public.habit_freezes
language plpgsql
set search_path = ''
as $$
declare
  v_habit public.habits;
  v_start date;
  v_row public.habit_freezes;
begin
  select h.* into v_habit from public.habits h where h.id = p_habit_id and h.archived_at is null for update;
  if not found or v_habit.group_id is null or not private.can_act_for(p_actor, p_profile_id)
     or not private.takes_part(v_habit, p_profile_id) then
    raise exception 'keepup:habit_not_found' using errcode = 'P0002';
  end if;

  v_start := coalesce(p_starts_on, private.habit_today(v_habit, p_now));
  if v_start < private.habit_today(v_habit, p_now) then
    raise exception 'keepup:freeze_in_past' using errcode = 'P0001';
  end if;
  if p_ends_on is not null and p_ends_on < v_start then
    raise exception 'keepup:freeze_range_invalid' using errcode = 'P0001';
  end if;
  if private.is_member_frozen(p_habit_id, p_profile_id, v_start, coalesce(p_ends_on + 1, 'infinity'::date)) then
    raise exception 'keepup:freeze_overlaps' using errcode = 'P0001';
  end if;

  insert into public.habit_freezes (habit_id, user_id, starts_on, ends_on, created_by)
  values (p_habit_id, p_profile_id, v_start, p_ends_on, p_actor)
  returning * into v_row;
  return v_row;
end;
$$;

create function private.unfreeze_member_impl(p_habit_id uuid, p_actor uuid, p_profile_id uuid, p_now timestamptz)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_habit public.habits;
  v_today date;
begin
  select h.* into v_habit from public.habits h where h.id = p_habit_id for update;
  if not found or not private.can_act_for(p_actor, p_profile_id) then
    raise exception 'keepup:habit_not_found' using errcode = 'P0002';
  end if;
  v_today := private.habit_today(v_habit, p_now);
  delete from public.habit_freezes where habit_id = p_habit_id and user_id = p_profile_id and starts_on >= v_today;
  update public.habit_freezes set ends_on = v_today - 1
   where habit_id = p_habit_id and user_id = p_profile_id and starts_on < v_today and (ends_on is null or ends_on >= v_today);
end;
$$;

create or replace function private.delete_habit_impl(p_habit_id uuid, p_user_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_habit public.habits;
begin
  select h.* into v_habit from public.habits h where h.id = p_habit_id for update;
  if not found or coalesce(private.habit_role(v_habit, p_user_id), '') not in ('owner', 'admin', 'guardian') then
    raise exception 'keepup:habit_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.check_ins c where c.habit_id = p_habit_id) then
    raise exception 'keepup:habit_has_history' using errcode = 'P0001';
  end if;
  delete from public.habits where id = p_habit_id;
end;
$$;

-- 12. Creating a group habit (admins; spec: Editing and lifecycle).
create function private.create_group_habit_impl(
  p_actor uuid, p_group_id uuid, p_title text, p_emoji text, p_category public.habit_category,
  p_target_count int, p_period public.habit_period, p_starts_on date, p_requires_approval boolean,
  p_children uuid[], p_now timestamptz)
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
                             requires_approval, created_by, created_at)
  values (null, p_group_id, p_title, p_emoji, p_category, p_target_count, p_period, p_starts_on,
          coalesce(p_requires_approval, false), p_actor, p_now)
  returning * into v_habit;

  insert into public.group_habit_participants (habit_id, profile_id)
  select distinct v_habit.id, x.id from unnest(coalesce(p_children, '{}')) x(id);
  return v_habit;
end;
$$;

-- 13. Summaries for Today, Progress and the kid view (decision 4: names come from here).
create function private.subject_summaries(p_subject uuid, p_now timestamptz)
returns table (
  habit_id uuid, title text, category public.habit_category, emoji text, target_count smallint,
  period public.habit_period, starts_on date, created_at timestamptz, archived_at timestamptz,
  period_start date, not_started boolean, done_count int, checked_in_today boolean, frozen boolean,
  frozen_until date, days_left int, current_streak int, best_streak int,
  group_id uuid, group_name text, requires_approval boolean, pending_count int, group_done boolean,
  my_role text, members jsonb)
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
           order by f.ends_on nulls first
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
                    'required', p.id in (select private.required_members(h, cur.start)),
                    'done_count', (select count(*)::int from public.check_ins c
                                    where c.habit_id = h.id and c.user_id = p.id and c.period_start = cur.start and c.status = 'approved'),
                    'pending_count', (select count(*)::int from public.check_ins c
                                       where c.habit_id = h.id and c.user_id = p.id and c.period_start = cur.start and c.status = 'pending'),
                    'paused', private.is_member_frozen(h.id, p.id, ctx.today, ctx.today + 1))
                  order by p.kind, p.display_name), '[]'::jsonb)
             from public.profiles p
            where private.takes_part(h, p.id)
              and (p.id in (select m.user_id from public.group_members m where m.group_id = h.group_id and m.left_at is null)
                   or p.id in (select gp.profile_id from public.group_habit_participants gp where gp.habit_id = h.id)))
         end
    from public.habits h
    left join public.groups g on g.id = h.group_id
    cross join lateral (select private.habit_today(h, p_now) as today) ctx
    cross join lateral (select private.habit_period_start(h, ctx.today) as start) s0
    cross join lateral (select s0.start, private.period_end(h.period, s0.start) as finish) cur
    cross join lateral private.habit_streaks(h.id, p_now) st
   where h.owner_id = p_subject or (h.group_id is not null and private.takes_part(h, p_subject))
   order by h.archived_at nulls first, h.group_id nulls first, h.created_at;
$$;

-- habit_summaries now covers the caller's group habits too; the return type grows, so it's recreated.
drop function public.habit_summaries();
drop function private.habit_summaries(uuid, timestamptz);

create function public.habit_summaries()
returns table (
  habit_id uuid, title text, category public.habit_category, emoji text, target_count smallint,
  period public.habit_period, starts_on date, created_at timestamptz, archived_at timestamptz,
  period_start date, not_started boolean, done_count int, checked_in_today boolean, frozen boolean,
  frozen_until date, days_left int, current_streak int, best_streak int,
  group_id uuid, group_name text, requires_approval boolean, pending_count int, group_done boolean,
  my_role text, members jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.subject_summaries(auth.uid(), now());
$$;

-- 14. Public API
create function public.create_group_habit(
  p_group_id uuid, p_title text, p_emoji text, p_category public.habit_category, p_target_count smallint,
  p_period public.habit_period, p_starts_on date default null, p_requires_approval boolean default false,
  p_children uuid[] default '{}')
returns public.habits language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return private.create_group_habit_impl(auth.uid(), p_group_id, p_title, p_emoji, p_category, p_target_count,
    p_period, p_starts_on, p_requires_approval, p_children, now());
end;
$$;

-- "Me + Mary": the caller's check-in and each child's, all or nothing.
create function public.check_in_with(p_habit_id uuid, p_children uuid[])
returns setof public.check_ins language plpgsql security definer set search_path = '' as $$
declare
  v_row public.check_ins;
  v_child uuid;
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  v_row := private.check_in_impl(p_habit_id, auth.uid(), now());
  return next v_row;
  foreach v_child in array coalesce(p_children, '{}') loop
    v_row := private.check_in_impl(p_habit_id, auth.uid(), now(), v_child);
    return next v_row;
  end loop;
end;
$$;

create function public.check_in_for(p_habit_id uuid, p_child_id uuid, p_by_child boolean default false)
returns public.check_ins language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  if p_child_id = auth.uid() then raise exception 'keepup:not_a_child' using errcode = 'P0001'; end if;
  return private.check_in_impl(p_habit_id, auth.uid(), now(), p_child_id, p_by_child);
end;
$$;

create function public.review_check_in(p_check_in_id uuid, p_approve boolean)
returns public.check_ins language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return private.review_check_in_impl(p_check_in_id, auth.uid(), p_approve, now());
end;
$$;

-- "Approve all": reviews what it can; ones someone else just reviewed (or whose window closed) are
-- skipped, not errors. Returns how many this call reviewed.
create function public.review_check_ins(p_check_in_ids uuid[], p_approve boolean)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_done int := 0;
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  foreach v_id in array coalesce(p_check_in_ids, '{}') loop
    begin
      perform private.review_check_in_impl(v_id, auth.uid(), p_approve, now());
      v_done := v_done + 1;
    exception when others then
      if sqlerrm not in ('keepup:already_reviewed', 'keepup:review_closed') then raise; end if;
    end;
  end loop;
  return v_done;
end;
$$;

create function public.freeze_member(p_habit_id uuid, p_profile_id uuid default null, p_starts_on date default null, p_ends_on date default null)
returns public.habit_freezes language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return private.freeze_member_impl(p_habit_id, auth.uid(), coalesce(p_profile_id, auth.uid()), p_starts_on, p_ends_on, now());
end;
$$;

create function public.unfreeze_member(p_habit_id uuid, p_profile_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  perform private.unfreeze_member_impl(p_habit_id, auth.uid(), coalesce(p_profile_id, auth.uid()), now());
end;
$$;

revoke execute on function
  public.habit_summaries(),
  public.create_group_habit(uuid, text, text, public.habit_category, smallint, public.habit_period, date, boolean, uuid[]),
  public.check_in_with(uuid, uuid[]), public.check_in_for(uuid, uuid, boolean),
  public.review_check_in(uuid, boolean), public.review_check_ins(uuid[], boolean),
  public.freeze_member(uuid, uuid, date, date), public.unfreeze_member(uuid, uuid)
  from public, anon;
grant execute on function
  public.habit_summaries(),
  public.create_group_habit(uuid, text, text, public.habit_category, smallint, public.habit_period, date, boolean, uuid[]),
  public.check_in_with(uuid, uuid[]), public.check_in_for(uuid, uuid, boolean),
  public.review_check_in(uuid, boolean), public.review_check_ins(uuid[], boolean),
  public.freeze_member(uuid, uuid, date, date), public.unfreeze_member(uuid, uuid)
  to authenticated;
