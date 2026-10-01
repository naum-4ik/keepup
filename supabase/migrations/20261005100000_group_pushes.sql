-- Push on for the group and approval events (spec: Events; ideas/notifications-tone.md). send-push
-- already builds their text (PR 4), so this is the only switch.

-- Copied from 20261004100000_reminder_scheduler.sql; the group kinds join.
create or replace function private.push_category(p_kind text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'nudge' then 'nudges'
    when 'check_in_rejected' then 'always'
    when 'daily_summary' then 'reminders'
    when 'habit_reminder' then 'reminders'
    when 'approval_expiring' then 'approvals'
    when 'approval_needed' then 'approvals'
    when 'group_check_in' then 'group_activity'
    when 'everyone_done' then 'group_activity'
    when 'kid_goal_reached' then 'group_activity'
    when 'kid_garden_full' then 'group_activity'
    when 'kid_streak' then 'group_activity'
    when 'group_streak_ended' then 'group_updates'
    when 'streak_back' then 'group_updates'
    when 'group_habit_created' then 'group_updates'
    when 'group_habit_paused' then 'group_updates'
    when 'group_habit_resumed' then 'group_updates'
    when 'member_joined' then 'group_updates'
  end;
$$;

-- Copied from 20261002100000_notification_prefs_push.sql; three per-event rules are new:
-- #9 only from a 3-period streak, #15 only admins, and "streak is back" only for a group.
create or replace function private.push_allowed(
  p_user uuid, p_kind text, p_habit_id uuid, p_group_id uuid, p_payload jsonb, p_now timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select c.category is not null
       and p.kind = 'adult'
       and (p.muted_until is null or p.muted_until <= p_now)
       and not coalesce(s.muted, false)
       and not (c.category = 'reminders' and p_habit_id is not null and not coalesce(s.reminders, true))
       and (c.category = 'always' or coalesce(np.enabled, true))
       and (p_kind <> 'group_streak_ended'
            or (case when p_payload ->> 'streak' ~ '^\d{1,9}$' then (p_payload ->> 'streak')::int else 0 end) >= 3)
       and (p_kind <> 'member_joined' or private.is_admin(p_group_id, p_user))
       and (p_kind <> 'streak_back' or p_group_id is not null)
      from (select private.push_category(p_kind) as category) c
      join public.profiles p on p.id = p_user
      left join public.habit_user_settings s on s.user_id = p_user and s.habit_id = p_habit_id
      left join public.notification_prefs np on np.user_id = p_user and np.category = c.category), false);
$$;

-- The last check-in writes group_check_in (to the others) and everyone_done (to all) in one transaction;
-- both would push under tag habit:<id> and buzz twice. The superseded group_check_in is marked sent
-- and reported as null, which send-push skips. Body copied from 20261002100000 (now private.push_job_build).
create function private.push_job_build(p_id uuid, p_now timestamptz default now())
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', n.id, 'kind', n.kind, 'user_id', n.user_id, 'pushed', n.pushed_at is not null,
    'group_id', n.group_id, 'group', g.name, 'habit_id', n.habit_id, 'habit', h.title, 'period', h.period,
    'target', h.target_count, 'check_in_id', n.check_in_id, 'check_in_status', c.status,
    'actor', a.display_name, 'subject_id', n.subject_id, 'subject', s.display_name, 'payload', n.payload,
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
      select coalesce(jsonb_agg(jsonb_build_object('check_in_id', pa.check_in_id, 'author', pa.author_name, 'habit', pa.habit_title)
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
   where n.id = p_id and n.push;
$$;

create or replace function public.push_job(p_id uuid, p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.notifications n
              where n.id = p_id and n.push and n.kind = 'group_check_in'
                and exists (select 1 from public.notifications d
                             where d.kind = 'everyone_done' and d.user_id = n.user_id and d.habit_id = n.habit_id
                               and d.created_at >= n.created_at)) then
    update public.notifications set pushed_at = now() where id = p_id and pushed_at is null;
    return null;
  end if;
  return private.push_job_build(p_id, p_now);
end;
$$;

revoke execute on function private.push_job_build(uuid, timestamptz) from public, anon, authenticated;
