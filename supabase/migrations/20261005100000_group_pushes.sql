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
       and (p_kind <> 'group_streak_ended' or coalesce((p_payload ->> 'streak')::int, 0) >= 3)
       and (p_kind <> 'member_joined' or private.is_admin(p_group_id, p_user))
       and (p_kind <> 'streak_back' or p_group_id is not null)
      from (select private.push_category(p_kind) as category) c
      join public.profiles p on p.id = p_user
      left join public.habit_user_settings s on s.user_id = p_user and s.habit_id = p_habit_id
      left join public.notification_prefs np on np.user_id = p_user and np.category = c.category), false);
$$;
