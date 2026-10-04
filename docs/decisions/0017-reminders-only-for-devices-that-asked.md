# 0017. Reminders only for devices that asked

**Status:** Accepted · 2026-10-04

## Context
Every profile has a reminder hour (default 20:00), but reminders are opt-in: people turn them on the first time they want one, and on iPhone only once Keepup is on the Home Screen.

## Decision
- Two `pg_cron` jobs run every 15 minutes: `keepup-reminders` and `keepup-expiring-approvals`. Each writes feed rows once, using dedupe keys.
- The daily summary is written only for adults with at least one push subscription, and isn't written when there's nothing to say. A habit's own `remind_at` is on the quarter hour (enforced by the database), is left out of the summary, and uses the group's day for group habits.
- "Turn on reminders" asks for the hour, then the browser's permission, then saves this device. On an iPhone without the Home Screen app it shows the Add to Home Screen steps; below iOS 16.4 it says reminders need a newer iOS.
- A device belongs to whoever subscribed on it last, and signing out removes it. Open apps re-save their subscription so active phones aren't dropped by the device cap.

## Consequences
- Nobody gets a daily Inbox row they never asked for.
- Someone with no device gets no reminders at all, even in the Inbox.
- A time-zone move west can skip one day's summary, never duplicate it.
