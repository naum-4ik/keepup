# 0004. Week start is snapshotted per habit

**Status:** Accepted · 2026-09-29

## Context
Weekly habits count "X times a week", and a week starts on Sunday or Monday depending on the user (Sunday is common in Israel). If the profile setting changed, weekly history computed from it would shift: finished weeks could change outcome after the fact.

## Decision
- `profiles.week_start` is the user's preference.
- Each habit copies it into `habits.week_start` when the habit is created. A trigger sets the value, and clients can't write it.
- Periods are always computed from the habit's own `week_start`. Changing the setting applies to weekly habits created from then on, which the Settings hint says.

## Consequences
- Past weeks never rewrite themselves.
- Cost: two weekly habits can use different week starts after a settings change. That's rare, and the hint explains it.
