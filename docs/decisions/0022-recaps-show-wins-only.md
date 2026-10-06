# 0022. Recaps show wins only, arrive in the Inbox, and run once

**Status:** Accepted · 2026-10-06

## Context
A weekly or monthly summary can motivate or shame. Today is for doing things, and a cron job that runs every few minutes must not send the same recap twice or stop for everyone when one person's data is odd.

## Decision
- A weekly recap on the first day of the person's week and a monthly one on the 1st, from 10:00 local, written by the `keepup-recaps` job (every 15 minutes) as Inbox rows. Nothing goes on Today.
- Wins only: no row when nothing was done, never "0 of N". Rested and skipped periods are left out of the count; your own part of a group habit counts. History says "A quiet week." for an empty period.
- A `recap_runs` marker (no API access, cleaned after 62 days) makes each person, group, kind and period run once, and a missed tick catches up later that day.
- Each person and group runs in its own sub-block, so one failure doesn't stop the others.
- `recaps()` returns the history for Progress → Recaps (last 8 weeks, 6 months with a day heatmap) from the same function.
- The family recap keeps its Inbox card; its push goes under Group updates. Personal recaps push under Achievements (0023).

## Consequences
- Re-running the job changes nothing.
- A person with nothing to report is not nagged.
