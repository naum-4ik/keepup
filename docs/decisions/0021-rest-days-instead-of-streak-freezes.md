# 0021. Rest days instead of streak freezes

**Status:** Accepted · 2026-10-06

## Context
A streak that ends after one busy day feels unfair, and buying or planning "freezes" turns a habit app into a game of tokens. Pauses already cover planned breaks (0006).

## Decision
- Private habits earn a rest day per 7 consecutive done days (weekly habits: per 4 done weeks), up to 2 saved. Monthly and group habits have none (a group streak needs everyone; groups use pauses).
- When finalization would mark a period `missed` and a rest day is saved, the period becomes `rested` and one is used. A paused period never uses one.
- A rested period keeps the streak going without adding to it. It sends no "streak ended" note. Badges treat it like a skipped period (0020).
- The balance is computed from `period_results`, not stored, and periods settle one at a time in date order, so a catch-up uses a saved day once.
- A late check-in on a rested day upgrades it to done and gives the rest day back.
- "Rest day used. Your 14-day streak is safe 💤" is an Inbox row under Achievements, and the first one awards "Rest well".

## Consequences
- No new table and no counter to drift.
- A refund is not re-applied to later missed days, because "streak ended" notes can't be retracted; the "rest day used" note stays after a refund.
- Past missed days were not rewritten.
