# 0012. Adults always take part in group habits; children opt in

**Status:** Accepted · 2026-09-30

## Context
A group habit is done when everyone required has checked in. Kids join groups too, but not every family habit is for them (date night), and a toddler can't be required for everything.

## Decision
- Every current adult member takes part in every habit of their group. Nothing is stored for adults.
- Children are chosen when the habit is created (off by default) and stored in `group_habit_participants`. The list is fixed once the habit exists.
- An adult is required for a period if they were a member from its start. The start is the later of the period start and the habit's `created_at`, so people there on day one count in the first period. Someone who joins mid-period is required from the next one.
- A member pause that overlaps a period means that person isn't required for it (decision 0006). Done still wins.
- Group habits are created from a group page, so they always have a group.

## Consequences
- An invited adult sees the group's habits at once, and nobody maintains participant lists.
- Cost: no habit can leave out one adult. Use a separate group for that.
