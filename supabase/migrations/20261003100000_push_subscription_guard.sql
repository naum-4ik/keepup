-- supabase/migrations/20261003100000_push_subscription_guard.sql
-- Saving a device (PR 2 review): knowing someone's endpoint is not enough to take it over, endpoints
-- must belong to a known push service (send-push posts to them), and one account keeps at most 10.

-- FCM (Chrome, Android, Edge on Android), Mozilla autopush (Firefox), Apple web push (Safari, iPhone:
-- web.push.apple.com only; api.push.apple.com is native APNs, never a browser endpoint), WNS
-- (Edge on Windows). The host must end right at "/" (or ":443/"), so "fcm.googleapis.com.evil.example"
-- and "fcm.googleapis.com@evil.example" don't pass.
create function private.is_push_service_endpoint(p_endpoint text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_endpoint ~* ('^https://('
    || 'fcm\.googleapis\.com'
    || '|([a-z0-9-]+\.)*push\.services\.mozilla\.com'
    || '|web\.push\.apple\.com'
    || '|[a-z0-9-]+\.notify\.windows\.com'
    || ')(:443)?/'), false);
$$;

-- The device follows whoever signed in last only when the call carries the keys the row already has
-- (the same browser's subscription). Another account with other keys is refused, so a row never ends
-- up pointing at keys its owner doesn't hold. The person's own device may renew its keys.
create or replace function private.save_push_subscription_impl(p_user uuid, p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_endpoint is null or not private.is_push_service_endpoint(p_endpoint) or char_length(p_endpoint) > 1000
     or coalesce(char_length(p_p256dh), 0) not between 1 and 200 or coalesce(char_length(p_auth), 0) not between 1 and 100 then
    raise exception 'keepup:invalid_subscription' using errcode = 'P0001';
  end if;
  insert into public.push_subscriptions as ps (user_id, endpoint, p256dh, auth, user_agent)
  values (p_user, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now()
    where ps.user_id = excluded.user_id or (ps.p256dh = excluded.p256dh and ps.auth = excluded.auth)
  returning ps.id into v_id;
  if v_id is null then
    raise exception 'keepup:invalid_subscription' using errcode = 'P0001';
  end if;
  -- At most 10 devices: the oldest go first, never the one just saved.
  delete from public.push_subscriptions d
   where d.user_id = p_user and d.id in (
     select x.id from public.push_subscriptions x
      where x.user_id = p_user and x.id <> v_id
      order by x.created_at desc, x.id desc
     offset 9);
end;
$$;

-- Rows saved before this guard (PR 2's looser https-only check) that aren't a known push service are
-- dropped: send-push would otherwise keep posting to them. Those devices can subscribe again.
delete from public.push_subscriptions where not private.is_push_service_endpoint(endpoint);
