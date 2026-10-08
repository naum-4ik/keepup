# 0025. Delete account is one database transaction

**Status:** Accepted · 2026-10-07

## Context
Settings → Delete account must delete the person and everything personal right away, with no grace period. Groups follow the spec's rules: a group left with no members is deleted (with its children), and where the person is the last admin and others remain, the longest-standing member becomes admin. A half-done delete (the login gone but the groups not handed over, or the other way round) would leave a group with no admin or a login with no profile. The usual route, Supabase's admin API (`auth.admin.deleteUser`), needs the service-role key in the app and runs as a second step after the database changes, so the two can't commit together.

## Decision
- `public.delete_my_account()` does all of it in one transaction: hand over admin, delete the groups left empty, then `delete from auth.users` for the caller. The profile and every personal row go by `on delete cascade` from there.
- It is `security definer` (owned by `postgres`, which may delete from `auth.users`), takes no arguments and acts only on `auth.uid()`; only `authenticated` may run it.
- `public.delete_account_preview()` runs the same plan (`private.delete_account_plan`) read-only, so the dialog says exactly what will happen: "Solo will be deleted, with Leo's profile.", "Ben becomes the admin of Family."
- Lock order: the habits involved (the person's private habits, their groups' habits, their groups' children's habits) in one query in id order, then the groups in id order, then the plan is counted. Feed and XP writes take a key-share lock on the group or profile while holding a habit, so the reverse order could deadlock; locking the groups before counting makes two last admins deleting at once run one after the other.
- The app then signs out locally (the token still verifies until it expires, but its user is gone) and opens the landing page with "Your account and data are deleted." The phone is cleared first, like a sign-out: waiting check-ins, saved pages, the push subscription.

## Consequences
- The admin API and the service-role key aren't needed in the app; the delete either happens completely or not at all.
- Tied to Supabase's `auth.users` table and its cascades: a change there in a Supabase upgrade would show in the pgTAP account-deletion tests.
- Staging check after the merge: delete a throwaway account from the app and confirm in Supabase → Authentication → Users that it's gone (proves the hosted `postgres` role may delete from `auth.users`, not only the local one).
