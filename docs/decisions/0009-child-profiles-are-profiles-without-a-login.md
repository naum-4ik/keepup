# 0009. Child profiles are profiles without a login

**Status:** Accepted · 2026-09-30

## Context
Kids have habits, check-ins, streaks and rewards like anyone else, but no account. Every habit, check-in and streak rule is keyed on `profiles`, and `profiles.id` referenced `auth.users`.

## Decision
- A child is a `profiles` row with `kind = 'child'` and `group_id` set. `profiles.id` no longer references `auth.users`; a trigger on `auth.users` delete keeps the cascade for adults.
- Only group admins add, move or delete a child. Any adult member of the group edits the profile, manages the child's habits, checks in for the child, sets treat goals and exports the child's data. This is one function, `can_act_for_profile`, used by RLS and the RPCs.
- `check_ins.logged_by` records the adult who logged a check-in: the user themselves for their own, `null` for a tap in the kid view. It becomes `null` if that adult's account is deleted.
- Kid profiles store a nickname, an emoji and a colour. No photo, birthdate or gender.

## Consequences
- Streaks, periods and history reuse the adult code paths. Kids are not a second model.
- Only adults can be group members (a trigger enforces it). Children belong through `profiles.group_id`.
- Cost: the `auth.users` cascade is now a trigger, not a foreign key. Account deletion (M6) must also handle a last admin.
