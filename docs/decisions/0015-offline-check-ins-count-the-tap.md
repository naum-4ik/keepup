# 0015. Offline check-ins count the tap

**Status:** Accepted · 2026-10-04

## Context
People check in on a phone in a lift, on a plane, or in the car with a child. A tap must never be lost, never count twice, and still land on the day it was made, while the database stays the only judge of what counts.

## Decision
- Every tap gets a client-made id (`check_ins.client_id`). The check-in RPC is idempotent on a resent id, so a retry after a lost response can't double-count.
- A queued tap carries the phone's time (`tapped_at`). The server accepts it from 3 days back to 5 minutes ahead, and the tap day uses `least(tapped_at, arrival)`, so a fast clock can't push a tap into tomorrow. Older taps are dropped with a feed note. Online taps send `tapped_at` null and use server time.
- A late tap or approval can upgrade a settled `missed` period to done and sends "streak is back". A late arrival on an approval habit gets 12 hours from arrival to be approved. Late group check-ins stay in the Inbox and don't push.
- A duplicate for a child from another adult merges quietly. An undo is applied by `client_id` under the rules at sync time.
- The queue lives in IndexedDB. Online taps are queue-first: saved, then sent, and removed only on success or a known rule code. One sender at a time (Web Locks). A tap is given up only after 5 counted failures over more than 24 hours; timeouts, 401 and no network don't count.
- The service worker keeps the last Today and kid view, with their scripts, so they open offline.
- Sign-out tries one send of the queue (at most 5 seconds). If anything is still waiting (always, offline), a confirm names how many check-ins haven't been saved: "Stay signed in" leaves the queue as it is; "Sign out anyway" goes on. Signing out deletes that person's queue database (`keepup-offline-<userId>`) and the saved pages from the phone. An empty queue signs out without asking.

## Consequences
- No conflict dialogs; every client and job sees the same result.
- Someone could set their phone's clock back, but only by 3 days.
- Results can change after they're written (`missed` to done), so anything derived from `period_results` must handle updates, not only inserts (M5 XP).
- The day is judged in the time zone at sync time, not at tap time.
