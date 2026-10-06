# 0023. Achievements arrive quietly; only level-ups and badges take the screen

**Status:** Accepted · 2026-10-06

## Context
Milestones, recaps and rest-day notes could fill the app with noise, and pushes at the moment a period settles would arrive around midnight. Celebrations also must not slow down a check-in.

## Decision
- Streak milestones, rest days, recaps, level-ups and badges are Inbox rows under a new push category, Achievements, which is **Inbox only** until the person chooses Sound or Silent. The weekly family recap push is a Group updates row.
- Level-ups and new badges get a ~2 second full-screen moment with soft confetti, once, when a page opens, closed by a tap, Escape or the timer. Settings → Celebrations → Subtle turns it into a small toast. It plays only while the tab is visible, never in the kid view, and reduced motion is respected. It is not a dialog that traps focus.
- One shared turn queue (`lib/burst-turns.ts`) covers finish cards, "Everyone did it", the all-done confetti and this moment, so two bursts never play at once.
- Celebrations load and mark-seen through `/api/celebrations` (same-origin check, then session, then validation; own rows only; `no-store`) instead of server actions, because Next runs a page's server actions one at a time and they would hold up a check-in.

## Consequences
- A person who never opens Settings is never buzzed by achievements.
- Pushes for milestones and rest days can arrive soon after midnight for people who opt in, when finalization settles the day. Accepted.
