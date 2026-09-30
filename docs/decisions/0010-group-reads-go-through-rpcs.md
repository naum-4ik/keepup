# 0010. Group reads go through RPCs

**Status:** Accepted · 2026-09-30

## Context
Group pages, Today's member avatars, the Inbox and the kid screens show other people's names and avatars. A `profiles` policy that let group members read each other's rows would also expose time zone, purpose and reminder hour.

## Decision
- Nobody reads another person's `profiles` row. The policy stays "own row only".
- Shared views come from `SECURITY DEFINER` functions that check membership first and return only the fields the screen needs: `my_groups`, `group_detail`, `habit_summaries`, `my_children`, `child_summaries`, `child_rewards`, `inbox_feed` and similar.
- Group tables (`groups`, `group_members`, `group_invites`, `notifications` and others) have no direct grants. Writes go through RPCs too.

## Consequences
- The columns other people can see are listed in one place per function, and pgTAP covers the non-member and ex-member cases.
- Adding a field to a screen means changing a function, not a policy.
- Cost: no ad-hoc PostgREST table queries for group data. Each new screen needs a function.
