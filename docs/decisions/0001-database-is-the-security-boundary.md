# 0001. The database is the security boundary

**Status:** Accepted · 2026-09-28

## Context
Keepup mixes private habits with shared family data and, later, children's profiles. A leak of someone else's habits would be the worst bug the app could have.

## Decision
Every rule that protects data or keeps it consistent lives in Postgres, not in the Next.js code:
- **Row Level Security** on every table. A pgTAP test fails if a table is added without it.
- **Column grants:** clients can't write server-owned columns (`onboarded_at`, `week_start`, `terms_accepted_at`, `archived_at`).
- **Rule functions** live in a `private` schema and take `p_now`, so clients can never pass a time. `SECURITY DEFINER` wrappers in `public` supply `now()` and `auth.uid()`. Every public function revokes execute from `anon`, and a guard test checks that.
- **Server-owned tables** (`check_ins`, `habit_freezes`, `period_results`) have no client write grants. They change only through those functions.

## Consequences
- The UI can have bugs without leaking data. Server Actions validate input for friendly messages, but they aren't trusted.
- The rules are tested once, in pgTAP (about 200 tests), instead of in every screen.
- Cost: logic in SQL is harder to write and review than TypeScript, and `SECURITY DEFINER` needs care (`search_path = ''`, ownership checks).
