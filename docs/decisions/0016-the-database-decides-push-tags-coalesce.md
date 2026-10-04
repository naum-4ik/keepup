# 0016. The database decides push; tags coalesce

**Status:** Accepted · 2026-10-04

## Context
Pushes start from many places: a check-in, a review, a pause, a cron job. Preferences have a precedence (pause all, habit mute, per-habit reminders, category), and a family shouldn't get four pushes for four check-ins on the same habit.

## Decision
- A trigger on `notifications` sets `category` and `push` from the preferences, so every path that writes the feed is covered (0014). One function decides which kinds push. Mutes, Pause all and category choices always win.
- Each category is delivered as Sound, Silent or Inbox only. The default is Silent. iPhone can't silence a single push (one system switch per app), so Settings says so there.
- Delivery goes through `private.dispatch_push` and `pg_net` to the `send-push` Edge Function. A missing or wrong secret only logs a warning and never blocks the user's action. The function checks the webhook secret in constant time and sends one push per device. 404/410 removes the device.
- Subscriptions are guarded in the database: a push-host allowlist, a takeover rule (another user's endpoint is saved only with matching keys), and at most 10 devices per user.
- Each push has a `tag` (`habit:<id>`, `approvals`, `reminder`), so a newer push replaces the older one. On the last check-in, the superseded `group_check_in` is skipped, so the group buzzes once.

## Consequences
- The VAPID private key and the webhook secret live only in Supabase; the browser has the public key.
- Preferences are tested in pgTAP like every other rule.
- A failed send isn't retried; the feed row stays.
