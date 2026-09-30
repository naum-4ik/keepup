-- Restore an archived habit (design review, 2026-09-30; keepup-notes ideas/design-review-backlog.md).
-- Archived habits only: finished ones use Start again. The archived gap is settled as skipped, never
-- missed (like keep_going), so the streak carries on. Group habits: admins only.

-- habit_rules: copied from 20260930100100_group_habits.sql; only the archived_at block changes.
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

  -- Archiving is one-way from the client; only restore_habit_impl clears it (the flag is transaction-
  -- local and can't be set through the API).
  if tg_op = 'UPDATE' and new.archived_at is distinct from old.archived_at then
    if not (new.archived_at is null and coalesce(current_setting('keepup.restoring', true), '') = 'on') then
      new.archived_at := coalesce(old.archived_at, now());
    end if;
  end if;
  return new;
end;
$$;


create function private.restore_habit_impl(p_actor uuid, p_habit_id uuid, p_now timestamptz)
returns public.habits
language plpgsql
set search_path = ''
as $$
declare
  v_habit public.habits := private.habit_for_update(p_habit_id);
  v_step interval;
  v_from date;
  v_current date;
begin
  perform private.require_habit_manager(p_actor, v_habit);
  if v_habit.archived_at is null then
    raise exception 'keepup:not_archived' using errcode = 'P0001';
  end if;
  if v_habit.finished_at is not null then
    raise exception 'keepup:habit_finished' using errcode = 'P0001';
  end if;
  v_step := private.period_step(v_habit.period);
  -- From the period it was archived in (unless done by then) up to the one before today's.
  v_from := greatest(private.habit_period_start(v_habit, private.habit_today(v_habit, v_habit.archived_at)),
                     private.first_period_start(v_habit));
  v_current := private.habit_period_start(v_habit, private.habit_today(v_habit, p_now));
  insert into public.period_results (habit_id, period_start, outcome, finalized_at)
  select v_habit.id, s.d::date,
         case when private.period_outcome(v_habit, s.d::date) = 'done' then 'done' else 'skipped' end, p_now
    from generate_series(v_from::timestamp, v_current::timestamp - v_step, v_step) as s(d)
  on conflict (habit_id, period_start) do nothing;
  perform set_config('keepup.restoring', 'on', true);
  update public.habits set archived_at = null where id = p_habit_id returning * into v_habit;
  perform set_config('keepup.restoring', '', true);
  return v_habit;
end;
$$;

create function public.restore_habit(p_habit_id uuid)
returns public.habits language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return private.restore_habit_impl(auth.uid(), p_habit_id, now());
end;
$$;

revoke execute on function public.restore_habit(uuid) from public, anon;
grant execute on function public.restore_habit(uuid) to authenticated;
