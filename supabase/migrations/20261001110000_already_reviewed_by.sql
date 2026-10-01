-- "Already reviewed by X" (spec: Rules → Approval: a second reviewer sees who reviewed it first).
-- Copied from 20261001100000_db_hardening.sql; only the already_reviewed branch is new: it carries
-- the reviewer's display name in the error DETAIL. review_check_ins matches on sqlerrm, which the
-- detail doesn't change, so a batch still skips these.
create or replace function private.review_check_in_impl(p_check_in_id uuid, p_actor uuid, p_approve boolean, p_now timestamptz)
returns public.check_ins
language plpgsql
set search_path = ''
as $$
declare
  v_check_in public.check_ins;
  v_habit public.habits;
  v_habit_id uuid;
  v_reviewer text;
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
    -- Only members get here (checked above), so the reviewer's name stays inside the group.
    -- An expired check-in, or one whose reviewer deleted their account, has no name to give.
    select p.display_name into v_reviewer from public.profiles p where p.id = v_check_in.reviewed_by;
    if v_reviewer is null then
      raise exception 'keepup:already_reviewed' using errcode = 'P0001';
    end if;
    raise exception 'keepup:already_reviewed' using errcode = 'P0001', detail = v_reviewer;
  end if;
  if p_now >= private.review_deadline(v_habit, v_check_in.period_start) then
    raise exception 'keepup:review_closed' using errcode = 'P0001';
  end if;

  update public.check_ins
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = p_actor, reviewed_at = p_now
   where id = p_check_in_id
  returning * into v_check_in;

  if p_approve then
    update public.period_results r set outcome = 'done'
     where r.habit_id = v_habit.id and r.period_start = v_check_in.period_start and r.outcome = 'skipped'
       and private.period_outcome(v_habit, v_check_in.period_start) = 'done';
  end if;
  return v_check_in;
end;
$$;
