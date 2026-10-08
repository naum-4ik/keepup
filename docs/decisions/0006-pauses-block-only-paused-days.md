# 0006. Pauses block only paused days; done beats skipped

**Status:** Accepted · 2026-09-29

## Context
The first version treated any pause that touched a week or month as covering all of it. Check-ins were blocked on days that weren't paused. Resuming mid-week still blocked the week, and pausing after finishing a week turned it into "skipped" and cut the streak. The M2 final review found this.

## Decision
- **Check-ins** and the "paused" state follow **today**: you can check in unless today is inside a pause.
- The **outcome** of a period still treats any overlapping pause as a reason to skip, so a pause protects the streak. But **done wins**: a period that reached its target is done, whether or not a pause touches it.

## Consequences
- Pausing and resuming behave the way people expect on weekly and monthly habits, and streaks are never cut by a pause.
- Cost: a pause can excuse an unfinished week. That's accepted, because pauses exist for real life (travel, illness).
