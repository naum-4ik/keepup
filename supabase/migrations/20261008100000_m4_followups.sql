-- M4 follow-ups (keepup-notes ideas/m4-followups.md). Every function replaced below is copied from its
-- latest definition; only the parts its comment names change. Sources:
--   private.enqueue_expiring_approvals  20261006100000_offline_check_ins.sql
--   private.enqueue_reminders           20261004100000_reminder_scheduler.sql
-- New functions call private.save_push_subscription_impl (latest: 20261003100000_push_subscription_guard.sql)
-- unchanged, so a saved device always passes the same guards (known push service, takeover, cap).

-- 1. A rotated subscription (the service worker's pushsubscriptionchange) in one transaction: only
-- while the caller still has the old device, the new one is saved and the old row dropped. A device
-- removed under Devices (or someone else's) is a no-op: false. A refused save raises and rolls the
-- whole call back, so the old row stays.
-- Locks: the old row (FOR UPDATE), then whatever the save takes. A Remove at the same moment waits,
-- or wins and this finds nothing.
create function private.rotate_push_subscription_impl(
  p_user uuid, p_old_endpoint text, p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.push_subscriptions ps
   where ps.endpoint = p_old_endpoint and ps.user_id = p_user
     for update;
  if not found then
    return false;
  end if;
  perform private.save_push_subscription_impl(p_user, p_endpoint, p_p256dh, p_auth, p_user_agent);
  if p_endpoint is distinct from p_old_endpoint then
    delete from public.push_subscriptions ps where ps.endpoint = p_old_endpoint and ps.user_id = p_user;
  end if;
  return true;
end;
$$;

-- 2. The app's re-save on open (M4 final review M2, a phone shared without signing out). It saves this
-- browser's subscription for whoever is signed in, as long as the device is still saved for anyone:
-- the save's takeover rule then moves a device to the new account only with the keys the row already
-- has (the same browser). A device removed under Devices has no row, from this phone or another one,
-- so it stays removed: false, nothing saved. (Saving whenever the browser has a subscription would
-- bring back a phone removed from a laptop: that phone's browser keeps its subscription.)
-- Locks: the row (FOR UPDATE) before the save, so a Remove at the same moment isn't undone.
create function private.refresh_push_subscription_impl(
  p_user uuid, p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.push_subscriptions ps where ps.endpoint = p_endpoint for update;
  if not found then
    return false;
  end if;
  perform private.save_push_subscription_impl(p_user, p_endpoint, p_p256dh, p_auth, p_user_agent);
  return true;
end;
$$;

create function public.rotate_push_subscription(
  p_old_endpoint text, p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return private.rotate_push_subscription_impl(auth.uid(), p_old_endpoint, p_endpoint, p_p256dh, p_auth, p_user_agent);
end;
$$;

create function public.refresh_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return private.refresh_push_subscription_impl(auth.uid(), p_endpoint, p_p256dh, p_auth, p_user_agent);
end;
$$;

revoke execute on function
  public.rotate_push_subscription(text, text, text, text, text), public.refresh_push_subscription(text, text, text, text)
  from public, anon;
grant execute on function
  public.rotate_push_subscription(text, text, text, text, text), public.refresh_push_subscription(text, text, text, text)
  to authenticated;

-- 3. Copied from 20261006100000_offline_check_ins.sql (its latest definition). New: no "approval
-- expiring" while the check-in's approval_needed push is less than 2 hours old: the reviewers just
-- got a fresh push, a second one minutes later only rings again (M4 final review M4). A check-in that
-- arrived 2–4 hours before the close still gets its reminder, once that push is 2 hours old. The
-- approval_needed row is written by the check-in's own insert, so the check-in's created_at is when
-- that push went out.
create or replace function private.enqueue_expiring_approvals(p_now timestamptz)
returns int
language plpgsql
set search_path = ''
as $$
declare
  r record;
  v_n int := 0;
begin
  for r in
    select c.id, c.user_id, c.habit_id, h.group_id
      from public.check_ins c
      join public.habits h on h.id = c.habit_id
     where c.status = 'pending' and h.group_id is not null and h.archived_at is null
       and p_now >= private.check_in_deadline(h, c) - interval '2 hours'
       and p_now < private.check_in_deadline(h, c)
       and not (c.created_at > p_now - interval '2 hours'
                and exists (select 1 from public.notifications n where n.check_in_id = c.id and n.kind = 'approval_needed'))
     order by h.id, c.id
  loop
    perform 1 from public.habits h where h.id = r.habit_id and h.archived_at is null for update;
    if not found then
      continue;
    end if;
    if not exists (select 1 from public.check_ins c where c.id = r.id and c.status = 'pending') then
      continue;
    end if;
    v_n := v_n + private.notify_count(private.group_adults(r.group_id, array[r.user_id]), 'approval_expiring',
      'expiring:' || r.id, r.group_id, r.habit_id, r.id, r.user_id, null, '{}'::jsonb);
  end loop;
  return v_n;
end;
$$;

-- 4. Copied from 20261004100000_reminder_scheduler.sql (its latest definition). The daily summary part
-- is unchanged. New, in the habit reminders: each reminder time is checked on the person's local
-- today and yesterday, so a 23:45 time whose own tick didn't run is still written by a tick in the
-- hour after it, past midnight. Whether the habit is still open is judged as of the reminder's own
-- instant (reminder_items at that time), so the 00:00 tick doesn't judge the new day; the row is keyed
-- by the habit day at that instant, so it's written once.
create or replace function private.enqueue_reminders(p_now timestamptz)
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_user record;
  v_today date;
  v_at timestamptz;
  v_items jsonb;
  v_n int := 0;
  r record;
begin
  for v_user in
    select p.id, p.timezone, p.reminder_hour from public.profiles p
     where p.kind = 'adult' and exists (select 1 from public.push_subscriptions ps where ps.user_id = p.id)
  loop
    v_today := private.local_date(p_now, v_user.timezone);
    v_at := private.local_instant(v_today, make_time(v_user.reminder_hour, 0, 0), v_user.timezone);
    if p_now >= v_at and p_now < v_at + interval '1 hour' then
      select jsonb_build_object(
               'todo', coalesce(jsonb_agg(jsonb_build_object('title', i.title, 'done', i.done, 'target', i.target)
                                          order by i.title, i.created_at) filter (where i.period = 'day'), '[]'::jsonb),
               'at_risk', coalesce(jsonb_agg(jsonb_build_object('title', i.title, 'done', i.done, 'target', i.target,
                                                                'period', i.period, 'days_left', i.days_left)
                                             order by i.title, i.created_at) filter (where i.at_risk), '[]'::jsonb))
        into v_items
        from private.reminder_items(v_user.id, p_now) i
       where i.remind_at is null and (i.period = 'day' or i.at_risk);
      if jsonb_array_length(v_items -> 'todo') + jsonb_array_length(v_items -> 'at_risk') > 0 then
        -- One summary per local date in the person's current time zone. A move never sends a second
        -- one for a date (same key); a move west right after the summary can skip the next date's
        -- (its reminder hour may already have passed in the new zone). Accepted: a missed summary
        -- beats a duplicate.
        v_n := v_n + private.notify_count(array[v_user.id], 'daily_summary', 'daily_summary:' || v_today,
          null, null, null, null, null, v_items);
      end if;
    end if;
  end loop;

  -- remind_at is a wall-clock time in the person's own time zone. The habit's own day at the
  -- reminder's instant (the group's, for a group habit, as reminder_items judges it) keys the row, so
  -- one habit day gets one reminder.
  for r in
    select x.user_id, x.habit_id, x.habit_day
      from (select p.id as user_id, s.habit_id, private.habit_today(h, a.at) as habit_day
              from public.profiles p
              join public.habit_user_settings s on s.user_id = p.id and s.remind_at is not null
              join public.habits h on h.id = s.habit_id
             cross join lateral (values (private.local_date(p_now, p.timezone)), (private.local_date(p_now, p.timezone) - 1)) d(day)
             cross join lateral (select private.local_instant(d.day, s.remind_at, p.timezone) as at) a
             where p.kind = 'adult' and exists (select 1 from public.push_subscriptions ps where ps.user_id = p.id)
               and p_now >= a.at and p_now < a.at + interval '1 hour'
               and exists (select 1 from private.reminder_items(p.id, a.at) i where i.habit_id = s.habit_id and i.remind_at is not null)) x
     order by x.habit_id, x.user_id
  loop
    perform 1 from public.habits h where h.id = r.habit_id for key share;
    if not found then
      continue;
    end if;
    v_n := v_n + private.notify_count(array[r.user_id], 'habit_reminder',
      'habit_reminder:' || r.habit_id || ':' || r.habit_day, null, r.habit_id, null, null, null, '{}'::jsonb);
  end loop;
  return v_n;
end;
$$;
