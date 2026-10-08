# 0014. The feed is written by triggers

**Status:** Accepted · 2026-09-30

## Context
Group activity ("Mary did it", approvals, milestones) must reach the Inbox whichever path changed the data: an RPC, a review, a pause, a job closing a period. Writing notifications in app code would miss some paths.

## Decision
- `AFTER` triggers on `check_ins`, `habits`, `habit_freezes`, `group_members` and `period_results` insert `notifications` rows, one per recipient. Nudges, kid moments and group milestones use the same table.
- Every row has a unique `dedupe_key`, so a repeated trigger or job adds nothing.
- "Everyone did it" locks the habit row before checking the period outcome. Two concurrent final approvals would otherwise each see the other as pending, and nobody would be told.
- The Inbox reads through an RPC and updates live through Realtime (RLS applies). Push comes in M4 on the same rows.
- Nudges have three preset kinds and no free text. Cheers and nudges are adults-only and feed-only in M3.

## Consequences
- Every client and job gets the same feed, and tests cover the rules in the database.
- Cost: more work inside write transactions, and trigger order matters.
- Deferred to M4/M5: approval expiring, daily reminder, private streak ended.
