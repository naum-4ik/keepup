# 0026. The demo is a database seed

**Status:** Accepted · 2026-10-07

## Context
"Try it" on the landing page must drop a visitor into a lived-in Keepup in about a second: Sam's 30 days with four private habits, a family group with a second adult (Alex) and a kid (Nova), streaks, a level, a few badges and one check-in waiting for approval. The spec sketched an Edge Function that signs up bot users and replays the history through the API. That means several round trips that can half-fail, bot logins in `auth.users`, and a seed that can only be tested end to end.

## Decision
- The visitor signs in with Supabase anonymous sign-in; every anonymous login is a demo login (`profiles.is_demo`, set by a trigger, never clearable through the API).
- `public.start_demo(p_timezone)` seeds everything in one transaction (`private.start_demo_impl`). It is `security definer`, only `authenticated` may run it, and it acts only on a demo caller. A second call is a no-op (`onboarded_at` is already set).
- People, the group, the kid and the habits are created through the normal functions, with triggers on. The history is then backdated with `session_replication_role = replica` (the e2e helpers' technique), and a result is written for every closed period by finalize's own rule (`settled_outcome`, oldest first). The seed never calls `finalize_periods` or `backfill_*`, which scan every user, and the cron finds nothing left to settle.
- Rewards are curated: an XP ledger of 480 (level 4, with room for a few taps before level 5), level-ups marked seen, and every badge the history earns awarded quietly. The visitor's first tap gives the normal XP and no surprise badge or level-up.
- The bot Alex is a demo profile row only: no login, no row in `auth.users`.
- Demo and real never mix: demo users can't create invites or add push devices, and a group is all-demo or all-real (database guards raising `keepup:demo`).
- `private.cleanup_demo` runs hourly and deletes demo profiles (and their groups) after 24 hours, unless the login was converted to a real one.

## Consequences
- The whole seed is covered by pgTAP, through the real call path (an authenticated anonymous user calling `start_demo`), including "finalize adds nothing" and "the first tap earns 10 + 12".
- The seed is tied to the current rules: a change to finalize, XP or badges can change what the demo shows. The pgTAP checks (level 4, streaks, results match `settled_outcome`) catch that.
- It takes about 0.4–0.5 s locally, mostly badge judging and the time zone check constraints.
- Staging check after the merge: start the demo once on staging. It proves the hosted `postgres` role may set `session_replication_role` inside a `security definer` function, not only the local one.
