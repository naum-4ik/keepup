# Keepup — Design

**Date:** 2026-09-28
**Status:** Design approved in conversation; written spec pending review
**Tagline:** Habits, together.

## Goal

A habit tracker that is complete for a single person and gets better with the people you live and hang out with. You track private habits on your own; you create a group (family, friends, roommates) and share group habits that everyone does together, with check-ins, optional approval by another member, streaks, XP, levels and achievements.

Two audiences:

1. **Real users** — the author and their family and friends. It must be pleasant enough to use daily on a phone.
2. **CV readers** — recruiters and engineers reading a public GitHub repo. It must run live, be one click to try, and show deliberate engineering: rules in the database, row-level security, tested time logic, CI, releases.

### Success criteria

- A new user signs up, picks two templates and checks in within two minutes.
- Two people in one group see each other's check-ins live and get push notifications on their phones (including iPhone, installed as a PWA).
- A recruiter clicks **Try demo** and within five seconds sees a populated account with history, a group, and a check-in waiting for their approval.
- Every rule in "Rules" below has a pgTAP test; every table has RLS enabled and tested.
- The repo has a live URL, CI badges, a changelog, tagged releases and a README explaining the interesting problems.

## Scope

### In v1

- Private habits and group habits.
- Groups with custom names, invite links, admin/member roles, multiple groups per user.
- Schedules: *X times per day / week / month*.
- Check-ins, optional approval, 12h approval grace, freezes (whole habit or one member).
- Streaks, XP ledger, levels, 12 achievements, habit categories and templates.
- In-app notification feed and Web Push, with mute controls.
- Google and magic-link sign-in, anonymous demo mode.
- Mobile-first PWA.
- SemVer releases via release-please, version shown in the app.

### Out of v1 (roadmap)

Hourly schedules · late check-ins / backfill · streak-freeze allowance · shared personal habits (a personal habit others can watch) · matching with strangers · amount-based habits (km, minutes, glasses as quantities) · group leaderboards · quiet hours · daily push cap · daily summary mode · email notifications · app-wide admin console · rejection reasons · native apps.

## Concepts

| Term | Meaning |
|---|---|
| **User** | A person with a profile. Can use the app entirely alone. |
| **Group** | A sharing group with a custom name ("Family", "BFs"). A user can belong to many. |
| **Admin / member** | A user's role *within one group*. A group can have several admins. |
| **Private habit** | Owned by one user. Only that user can see it. |
| **Group habit** | Owned by a group. Every member does it; it is done for a period only when all required members have done it. |
| **Period** | The day, ISO week (Monday start) or calendar month a habit is measured over. |
| **Check-in** | One "I did it" by one user on one habit. |
| **Approval** | On habits that require it, another member confirms a check-in before it counts. |
| **Freeze** | A pause: the period is skipped, neither done nor missed. |

## Architecture

```
 Phone / browser (PWA, service worker)
        │ HTTPS                         ▲ Web Push
        ▼                               │
 ┌──────────────────┐        ┌──────────┴────────────────────────┐
 │ Vercel           │        │ Supabase project                  │
 │ Next.js App      │  RPC   │  Postgres: tables, RLS, SQL rule  │
 │ Router, Server   │───────▶│   functions, triggers, pg_cron    │
 │ Components +     │        │  Auth (Google, magic link, anon)  │
 │ Server Actions   │        │  Realtime                         │
 └──────────────────┘        │  Edge Functions: send-push,       │
        ▲  Realtime (WS)     │   seed-demo                       │
        └────────────────────│                                   │
                             └───────────────────────────────────┘
```

**Principle:** business rules live in Postgres. Next.js renders and calls RPCs; it never decides whether a check-in counts. The browser uses the anon key under RLS. The service-role key exists only in Edge Functions and CI secrets.

**Stack:** Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, `@supabase/ssr`, Supabase (Postgres, Auth, Realtime, Edge Functions, `pg_cron`, `pg_net`), `web-push` with VAPID keys, Vercel hosting. The Supabase region and Vercel function region are set to the same location.

**Data access:**

- Reads: Server Components.
- Writes: Server Actions → Postgres RPCs (`check_in`, `undo_check_in`, `review_check_in`, `freeze_habit`, `unfreeze_habit`, `nudge`, `cheer`, `accept_invite`, …).
- Live updates: client Realtime subscriptions on Today, habit detail and Inbox only.

## Data model

Naming convention: primary keys are `id`; foreign keys are `<thing>_id`. All timestamps are `timestamptz`. Every table has RLS enabled.

| Table | Columns | Notes |
|---|---|---|
| `profiles` | `id` (= `auth.users.id`), `display_name`, `timezone`, `reminder_hour` (0–23, default 20), `muted_until`, `is_demo`, `created_at` | Created by trigger on signup. |
| `groups` | `id`, `name` (1–40 chars), `timezone`, `created_by`, `created_at` | Custom name; UI offers chips Family / Friends / Couple / Roommates. |
| `group_members` | `group_id`, `user_id`, `role` (`admin`/`member`), `joined_at`, `left_at` | PK (`group_id`, `user_id`). Rejoining clears `left_at` and sets a new `joined_at`. |
| `group_invites` | `id`, `token` (random, unique), `group_id`, `created_by`, `expires_at`, `revoked_at` | Admins only. Valid 7 days, reusable until expiry or revocation. |
| `habits` | `id`, `owner_id` *or* `group_id` (exactly one, CHECK), `title`, `category`, `target_count` (≥1), `period` (`day`/`week`/`month`), `requires_approval`, `created_by`, `archived_at`, `created_at` | `requires_approval` only allowed when `group_id` is set. |
| `habit_freezes` | `id`, `habit_id`, `user_id` (null = whole habit), `starts_on`, `ends_on` (null = open-ended), `created_by`, `created_at` | Dates in the habit's time zone. |
| `check_ins` | `id`, `habit_id`, `user_id`, `period_start` (date), `local_date` (date), `status` (`pending`/`approved`/`rejected`/`expired`), `reviewed_by`, `reviewed_at`, `created_at` | `period_start` and `local_date` computed by trigger in the habit's time zone. CHECK `reviewed_by <> user_id`. |
| `period_results` | `habit_id`, `period_start`, `outcome` (`done`/`missed`/`skipped`), `finalized_at` | PK (`habit_id`, `period_start`). One row per habit per period, private or group. |
| `xp_events` | `id`, `user_id`, `amount` (may be negative), `reason`, `source_type`, `source_id`, `created_at` | Append-only ledger. Unique (`user_id`, `reason`, `source_type`, `source_id`) prevents double grants. |
| `achievements` | `code` (PK), `name`, `description`, `icon`, `sort_order` | Seeded catalog. |
| `user_achievements` | `user_id`, `achievement_code`, `unlocked_at`, `seen_at` | PK (`user_id`, `achievement_code`). |
| `level_ups` | `user_id`, `level`, `reached_at`, `seen_at` | PK (`user_id`, `level`). Drives the celebration modal. |
| `cheers` | `check_in_id`, `user_id`, `created_at` | PK (`check_in_id`, `user_id`). |
| `nudges` | `sender_id`, `recipient_id`, `habit_id`, `local_date`, `created_at` | PK over all four except `created_at`: one nudge per sender → recipient → habit → day. |
| `notifications` | `id`, `user_id`, `kind`, `category`, `habit_id`, `payload` (jsonb), `dedupe_key` (unique), `push` (bool), `pushed_at`, `read_at`, `created_at` | The feed. `push` records whether preferences allowed a push. |
| `notification_prefs` | `user_id`, `category`, `enabled` | PK (`user_id`, `category`). Missing row = enabled. |
| `habit_user_settings` | `user_id`, `habit_id`, `muted`, `reminders` | PK (`user_id`, `habit_id`). Defaults: `muted=false`, `reminders=true`. |
| `push_subscriptions` | `id`, `user_id`, `endpoint` (unique), `p256dh`, `auth`, `user_agent`, `created_at` | One per device. |

Current XP = `sum(xp_events.amount)`; current level is derived from it (see "XP and levels").

## Rules

All rule functions take `p_now timestamptz default now()` so tests can pin time.

### Time zones and periods

- A **group habit** uses the group's `timezone`; a **private habit** uses its owner's `timezone`.
- `period_start` is the local date on which the period begins: the day itself, the Monday of the ISO week, or the 1st of the month.
- A period ends at local midnight after its last day. Postgres time-zone conversion handles DST.
- Changing a group's or profile's time zone applies from the next period. Existing check-ins and results are never recomputed.

### Required members (group habits)

A member is **required** for a period when they were a member for the whole period (`joined_at` ≤ period start and `left_at` is null or ≥ period end) and have no member freeze overlapping the period.

### Check-ins

`check_in(habit_id)` succeeds only when all hold:

1. The caller owns the private habit, or is a current member of the habit's group.
2. The habit is not archived.
3. The current period is open (no backfill) and not frozen for the habit or for the caller.
4. The caller has fewer than `target_count` non-rejected check-ins in this period.
5. For `week` and `month` habits: the caller has no non-rejected check-in on the same `local_date`.

Initial status:

- `approved` if the habit does not require approval, or if the group had fewer than 2 members at period start.
- `pending` otherwise.

`undo_check_in(id)`: the author may delete their own check-in while its period is open. Any XP granted for it is reversed with a negative ledger row.

### Approval

- Any **current member other than the author** may approve or reject a `pending` check-in.
- Reviews are accepted until **period end + 12h** (the grace window).
- The first review wins (conditional update). A second reviewer sees "already reviewed by X"; nothing changes.
- Reviews are final.
- A rejected check-in does not count; the author may check in again while the period is open.
- When the grace window closes, remaining `pending` check-ins become `expired` and do not count.

### Outcome of a period

Only `approved` check-ins count.

- **Private habit:** `done` when approved check-ins ≥ `target_count`.
- **Group habit:** `done` when every required member has ≥ `target_count` approved check-ins.
- **`skipped`** when a whole-habit freeze overlaps any part of the period, or when a group habit has no required members.
- Otherwise **`missed`**.

### Finalization

`finalize_periods()` runs from `pg_cron` every 15 minutes. For each non-archived habit whose period end + 12h has passed and which has no `period_results` row for that period, it expires pending check-ins, writes the outcome, grants period XP, evaluates achievements and enqueues notifications. It is idempotent: re-running changes nothing.

The open period's progress is computed live by a view (`habit_progress`), never stored.

### Streaks

- **Current streak:** consecutive `done` periods counted back from the latest finalized period, passing over `skipped` periods without breaking. A `missed` period ends it.
- The open period is shown as "in progress" and never breaks the streak.
- **Best streak:** the longest such run.
- Group habits have one streak shared by the group.

### Freezes

- **Whole habit:** the owner freezes a private habit; an admin freezes a group habit.
- **Member freeze:** any member freezes themselves on a group habit; they stop being required.
- `starts_on` must be today or later in the habit's time zone (no retroactive freezes).
- A freeze covering any part of a period affects the whole period.
- Unfreezing sets `ends_on` to yesterday (or deletes a freeze that has not started).
- While frozen: no check-ins, no reminders for that habit.

### Nudges and cheers

- **Nudge:** any member may nudge another member on a group habit when the target is required for the current period, has not reached `target_count`, has not checked in today, and is not frozen. Limit: one per sender → recipient → habit → local day.
- **Cheer:** any member may cheer another member's counted check-in on a group habit, once per check-in.

### Editing and lifecycle

- `title` and `category` are always editable.
- `target_count`, `period` and `requires_approval` are locked after the first check-in. To change them, archive and create a new habit.
- Habits are archived, never deleted; history remains.
- Group habits are created, edited, frozen (whole) and archived by admins only.

### Groups

- The creator becomes the first admin.
- Admins: create and revoke invites, remove members, promote and demote, rename, delete the group.
- The last admin cannot leave or be demoted while other members remain; they must promote someone first.
- Deleting a group deletes its habits and all their data.
- **Deleting an account** deletes the profile and all personal data. For every group where the user is the last admin and other members remain, the longest-standing member is promoted. A group left with no members is deleted.

## XP and levels

| Action | XP | Granted when |
|---|---|---|
| Counted check-in | +10 | Check-in becomes `approved` |
| Period done (private) | +20 | Finalization, to the owner |
| Period done (group) | +30 | Finalization, to every required member |
| Streak milestone 7 / 30 / 100 periods | +50 / +150 / +500 | Finalization, per habit, to the owner or every required member |
| Approving someone's check-in | +2 | Review with `approved` |

- Levels: `level = floor(sqrt(xp / 50)) + 1`. Level 2 at 50 XP, 5 at 800, 10 at 4,050.
- When XP crosses a level boundary, a `level_ups` row is inserted and a notification enqueued.
- The ledger's unique key makes every grant idempotent; undo inserts a negative row.
- Anti-farming follows from the check-in rules: only counted check-ins earn XP, at most `target_count` per period, one per day on weekly/monthly habits, no self-approval.

## Achievements (v1 catalog)

Evaluated in SQL after a check-in is approved and after finalization.

| Code | Name | Unlocks when |
|---|---|---|
| `first_step` | First Step | First counted check-in |
| `streak_7` | On Fire | Any habit reaches a 7-period streak |
| `streak_30` | Unstoppable | Any habit reaches a 30-period streak |
| `streak_100` | Legend | Any habit reaches a 100-period streak |
| `hydrated` | Hydrated | A Health habit with `period = day` and `target_count ≥ 8` is `done` 7 consecutive days |
| `bookworm` | Bookworm | 30 `done` periods across Mind habits |
| `runner` | Runner | 50 counted check-ins across Fitness habits |
| `team_player` | Team Player | 10 `done` group periods in which the user was required |
| `fair_judge` | Fair Judge | 20 approvals given |
| `early_bird` | Early Bird | 10 counted check-ins before 08:00 local time |
| `comeback` | Comeback | Reach a 7-period streak on a habit whose previous streak ended |
| `level_5` / `level_10` | Level 5 / Level 10 | Level reached |

Categories: 💧 Health · 🏃 Fitness · 📚 Mind · 🎓 Learning · 👨‍👩‍👧 Family · 🏠 Home · 💰 Finance · ✨ Other.

Templates: Drink water 8×/day (Health) · Read 20 min 1×/day (Mind) · Run 3×/week (Fitness) · Meditate 1×/day (Mind) · Family dinner 1×/week (Family) · Budget review 1×/month (Finance) · Tidy up 1×/day (Home) · Learn a language 1×/day (Learning).

## Notifications

### Channels

- **In-app feed** (`notifications`), always written, kept 60 days (cron deletes older rows).
- **Web Push**, when preferences allow.
- No email beyond magic-link sign-in.

### Events

Push is always subject to pause-all (`muted_until`) and habit mute. "Always" means not controlled by a category toggle.

| # | Event | Trigger | Recipients | Push | Category |
|---|---|---|---|---|---|
| 1 | Group check-in (no approval) | Member checks in | Other current, non-frozen members | Yes | Group activity |
| 2 | Check-in awaiting approval | Member checks in on an approval habit | Other current members | Yes, Approve/Reject actions | Approvals |
| 3 | Approval expiring | Cron, 2h before grace ends, still pending | Other current members | Yes, once per check-in | Approvals |
| 4 | Check-in rejected | Review = rejected | Author | Yes | always |
| 5 | Check-in approved | Review = approved | Author | Feed only | — |
| 6 | Nudge | Member taps Nudge | Target | Yes | Nudges |
| 7 | Cheer | Member taps Cheer | Author | Feed only | — |
| 8 | Daily reminder (includes at-risk) | Cron at the user's `reminder_hour` | That user | Yes, one per day | Reminders + per-habit `reminders` |
| 9 | Group streak ended | Finalization writes `missed` | All members | Yes if the streak was ≥ 3 periods, else feed only. Never names who missed. | Group updates |
| 10 | Group habit completed | Last required member's check-in approved | All members | Yes, same tag as #1 (replaces it) | Group activity |
| 11 | Private streak ended | Finalization writes `missed` | Owner | Feed only | — |
| 12 | Group habit created | Admin creates it | Other members | Yes | Group updates |
| 13 | Group habit frozen / unfrozen | Admin action | Other members | Yes | Group updates |
| 14 | Member froze themselves | Member action | Other members | Feed only | — |
| 15 | Member joined | Invite accepted | Admins push; everyone gets feed | Yes (admins) | Group updates |
| 16 | Member left or removed | Leave / remove | Admins | Feed only | — |
| 17 | Role changed | Promote / demote | Target | Feed only | — |
| 18 | Group habit archived | Admin action | Other members | Feed only | — |
| 19 | Achievement unlocked | Evaluation | That user | Yes | Achievements |
| 20 | Level up | XP crosses a boundary | That user | Yes | Achievements |

### Daily reminder content

At `reminder_hour` in the user's time zone, one push listing:

- **Not done yet:** habits whose current period is open, not frozen, reminders on, and the user still needs check-ins. Daily habits always qualify. Weekly habits qualify on Sunday; monthly habits on the last day of the month.
- **At risk:** weekly and monthly habits where *days left in the period (including today) = check-ins the user still needs*.

No push if the list is empty.

### Coalescing

- Push payloads carry a `tag`: `habit:<id>` for #1 and #10, `approvals` for #2 and #3, `reminder` for #8. A new push with the same tag replaces the previous one on the device.
- Text is built from current state at send time: "Anna and Dan checked in: Read", "3 check-ins waiting for your approval".
- `dedupe_key` (e.g. `reminder:<user>:<local_date>`, `expiring:<check_in>`) prevents duplicates.

### Pipeline

1. A trigger or rule function inserts `notifications` rows, one per recipient, with `push` computed from preferences.
2. A database webhook on insert where `push = true` calls the `send-push` Edge Function.
3. `send-push` loads the recipient's `push_subscriptions` and sends to each with `web-push`. HTTP 404/410 deletes the subscription. It sets `pushed_at`.
4. `pg_cron` every 15 minutes runs `enqueue_reminders()` (users whose local time crossed `reminder_hour` since the last run) and `enqueue_expiring_approvals()`.

The service worker handles Approve/Reject action buttons (Android, desktop) by calling `POST /api/check-ins/:id/review` with the session cookie. On iPhone, tapping opens `/inbox`.

### Mute controls

Precedence: **pause all** (`muted_until`: 1h / 8h / until tomorrow / until turned back on) → **habit mute** → **per-habit reminders** → **category toggles**.

Categories: Reminders · Group activity · Approvals · Nudges · Group updates · Achievements. All on by default. Turning off Approvals shows: "Your group can't complete habits that need your approval."

## Screens

Mobile-first PWA. **Header:** page title, 🔔 bell with unread badge (→ Inbox), avatar with level (→ Profile). **Bottom nav:** Today · Progress · **＋** · Groups · Profile.

| Route | Content |
|---|---|
| `/` | Public landing: pitch, screenshots, Sign in, Try demo |
| `/login` | Google, magic link |
| `/onboarding` | 1) name, time zone (auto-detected), reminder hour; 2) pick two templates; 3) push setup with iPhone "Add to Home Screen" guide; 4) create a group or skip |
| `/today` | Due-now cards grouped *Mine* / per group: category icon, title, progress, check-in button, streak 🔥, member avatars with done/pending/frozen. Approvals banner. "+10 XP" animation. Realtime. |
| `/progress` | Category tabs with completion %, heatmap per habit, current and best streaks, full habit list (active / archived) |
| `/habits/new` | Templates grid, then custom form: title, category, private or group, target × period, requires approval (group only) |
| `/habits/:id` | Heatmap, streaks, history; freeze, mute, reminders, archive. Group habits: per-member status, Nudge, Cheer. |
| `/groups`, `/groups/new`, `/groups/:id` | Group list with switcher; create with custom name and chips; members and roles, invite link (copy/share), rename, leave, delete, group habits |
| `/invite/:token` | Accept invite; sign in first if needed |
| `/inbox` | Approvals tab (approve / reject / approve all) and Activity feed |
| `/profile` | Level and XP bar, achievements grid (locked shown greyed with hint), stats, link to settings. Footer: `v1.1.0 · a3f9c21` → What's new |
| `/profile/settings` | Name, time zone, reminder hour, pause all, category toggles, push status per device, sign out, delete account |
| `/whats-new` | Rendered `CHANGELOG.md` |

Level-up and achievement celebrations are full-screen modals shown once, marked via `seen_at`.

## Demo mode

- **Try demo** signs in with Supabase anonymous auth and calls the `seed-demo` Edge Function.
- `seed-demo` creates two bot users (via the admin API, `is_demo = true`), a "Demo Family" group, four habits (two private, two group, one requiring approval), 30 days of back-dated history written directly by the service role, matching XP and a few achievements, and one pending bot check-in awaiting the visitor's approval.
- A daily cron deletes demo users and their bots older than 24h.
- Demo users cannot create invites.

## Versioning

- SemVer: `fix:` → patch, `feat:` → minor, breaking → major. Conventional Commits.
- release-please (GitHub Action) maintains a release PR; merging it bumps `package.json`, updates `CHANGELOG.md`, tags and creates a GitHub Release.
- The app reads the version from `package.json` at build time and the commit from `VERCEL_GIT_COMMIT_SHA`.

## Environments

| Env | App | Database |
|---|---|---|
| Local | `next dev` | `supabase start` (Docker) |
| PR preview | Vercel preview deployment | Staging Supabase project |
| Production | Vercel, from `main` | Production Supabase project |

Schema, RLS, functions and cron jobs live in `supabase/migrations/*.sql` and are applied by the Supabase CLI.

## Testing

- **pgTAP** (`supabase/tests/`): period bucketing across time zones and DST; check-in preconditions; approval, grace and expiry; required members; freezes; outcomes; streaks; XP grants and reversals; level-ups; each achievement; notification recipients and push flags; mute precedence; account deletion.
- **RLS tests:** a user cannot read another's private habit or check-ins; a non-member cannot read a group; an ex-member loses access; a member cannot invite; nobody can self-approve; demo users cannot invite.
- **Guard test:** every table in `public` has RLS enabled.
- **Vitest:** TypeScript helpers (level display, formatting, push payload text).
- **Deno tests:** `send-push` payload building and subscription cleanup.
- **Playwright E2E:** demo login → create habit → check in; two browser contexts: invite → join → check in → approve → both see done.

## CI (GitHub Actions)

- **Pull request:** lint, typecheck, Vitest, `supabase start` + `supabase db reset` + pgTAP, Playwright against the local stack.
- **Merge to `main`:** apply migrations to staging; release-please updates its PR.
- **Release published:** apply migrations to production. Vercel deploys production from `main`.
- **Daily:** keep-alive ping to both Supabase projects (free tier pauses after 7 days idle).
- Branch protection on `main`: PRs only, CI must pass.

## Security

- RLS on every table; policies tested.
- The anon key is the only key in the browser. The service-role key lives in Edge Functions and CI secrets.
- VAPID private key in Supabase secrets.
- Invite tokens are random and single-purpose; expired or revoked tokens are rejected.

## CV packaging

- README: pitch, live link, demo GIF, Mermaid architecture diagram and ERD, **Interesting problems** (time-zone periods and DST, approval with grace, RLS as the security boundary, the XP ledger, notification coalescing), local setup.
- `docs/adr/` for key decisions (rules in Postgres, SemVer, tag-based coalescing).
- CI and release badges, MIT license, GitHub Releases history.
