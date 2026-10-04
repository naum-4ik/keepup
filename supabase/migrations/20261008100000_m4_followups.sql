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
