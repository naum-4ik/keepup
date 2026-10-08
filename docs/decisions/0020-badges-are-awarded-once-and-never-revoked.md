# 0020. Badges are awarded once and never revoked

**Status:** Accepted · 2026-10-06

## Context
Badges reward things that can later be undone (a check-in, a late upgrade). Taking one back would feel punishing, and judging "a perfect week" for a group habit needs one clear rule.

## Decision
- 24 badges in a catalog table, no tiers: first steps, streaks, categories and family ones. "Go-getter" replaced "Saver". One pgTAP test per rule.
- `user_achievements` has the primary key (`user_id`, `achievement_code`): a badge is awarded once, with the date of the earliest moment it was earned, live and in the backfill. An undo never revokes.
- Badges are judged when a period settles and when it is upgraded. Inside finalization, "Approve all" and "Me + Mary" they are queued and written once after the loop, in user-id order, the same lock order as XP (0018).
- For a group habit, your own part counts, the same rule as the Today ring and the calendar. Paused periods are left out. "Perfect week" is judged once per person and week, after the week ends in the habit's time zone.
- A rested period (0021) counts like a skipped one for Perfect week, Full day and Steady month.
- Kids earn badges behind the scenes, with no Inbox rows. "Planted" for a child's habit goes to the adult who created it.
- Tables are read-only to clients: the catalog is readable when signed in, earned rows are read-own, no write grants.

## Consequences
- A badge can be earned "too early" only if the rule says so; nothing takes it back.
- The earliest-moment rule makes the backfill and live play agree.
