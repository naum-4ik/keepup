# 0013. Approval grace only for approval habits

**Status:** Accepted · 2026-09-30

## Context
With approval on, a check-in is pending until another adult reviews it. The reviewer may look after the period ends, so the period can't always be finalized at its end.

## Decision
- A pending check-in can be reviewed until the period end plus 12 hours, in the habit's (group's) time zone.
- Only habits with `requires_approval` get this grace. Other group habits finalize at period end, like private ones.
- While a closed period is in grace, streaks and history show it as `open` unless it is already `done`, so a streak never flickers.
- Reviews lock the habit row before the check-in, the same order as check-in and undo, so concurrent reviews and undos can't deadlock.

## Consequences
- Late approvals count, and habits without approval keep the simple rule.
- Cost: an approval habit's last period stays open for up to 12 hours after it ends.
