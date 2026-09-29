# 0005. The first period is never missed

**Status:** Accepted · 2026-09-29

## Context
A weekly habit created on Saturday has one day left in its first week. Marking that week "missed" would punish the user for starting, which goes against the "never guilt" principle.

## Decision
A habit's first period ends as **done** or **skipped**, never **missed**. The user can also choose a start date (today or later). Nothing before it counts, and the date locks after the first check-in.

## Consequences
- Starting a habit mid-week or mid-month is always safe, and streaks begin fairly.
- Cost: one more rule in the outcome function, pinned by pgTAP tests.
