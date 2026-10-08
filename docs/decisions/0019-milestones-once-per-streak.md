# 0019. Streak milestones once per streak; "Back to N" after a break

**Status:** Accepted · 2026-10-06

## Context
A streak milestone should feel earned once. But a late check-in can merge two streaks, periods can settle out of order, and a person who lost a 30-day streak and reaches 30 again deserves to hear it differently.

## Decision
- Schedules: days 1, 2, 5, 7, 10, 14, 30, 50, 100, 200, 365; weeks 1, 2, 4, 8, 12, 26, 52; months 1, 3, 6, 12. Each has bonus XP.
- The ledger key is the habit, the streak's first done period and the length, so a milestone is paid once per streak. When an upgrade merges two streaks, a length either piece already earned is not paid again.
- "Back to N" (private habits) means an earlier streak of the same habit reached N. It is read from the ledger or settled history, so it doesn't depend on the order periods are settled in.
- Milestones fire when a period is settled and when it is upgraded, walking forward over the later periods the merged streak now reaches.
- Personal milestones are Inbox rows under Achievements. A group milestone goes under Group updates, once per streak. A child's streak note goes to the adults, daily, from day 7. Late group and kid notes stay in the Inbox.

## Consequences
- Upgrading twice, or settling in reverse order, pays nothing extra.
- The backfill was quiet: no rows for streaks that already existed.
