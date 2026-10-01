# Keepup

**Habits, together.**

[![CI](https://github.com/naum-4ik/keepup/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/naum-4ik/keepup/actions/workflows/ci.yml)

A warm, mobile-first habit tracker for one person and for families. Pick a habit, check in with one tap, and watch your streaks grow. Next up: an installable app, offline check-ins and push reminders.

**Status:** in development (v0.x). Try the staging build at **https://keepup-murex.vercel.app**: sign up with an email and a password.

<p align="center">
  <img src="docs/screenshots/today.png" width="220" alt="Today: a progress card, then habits left to do, then Done for today">
  <img src="docs/screenshots/progress.png" width="220" alt="Progress: your week, streaks, and habits by category">
  <img src="docs/screenshots/calendar.png" width="220" alt="Calendar: a month of days, tap one to see what you did">
</p>

## What works today

- **Today:** a progress card (a ring of today's habits, what's left, and a small celebration when all are done), then a card per habit with its emoji, one-tap check-in, progress (e.g. `3 / 8 today`, `1 of 3 this week`) and a streak badge. It lists what's left to do first, then **Done for today**, then **Later** (habits that start later, or paused ones). Group and kid habits follow in their own sections.
- **Ready-made habits:** 48 templates, 6 in each of 8 categories (Health, Fitness, Mind, Learning, People, Home, Work & money, Break a habit), or create your own with any emoji. Schedules are *X times a day, week or month*. Choose a start date (today, tomorrow, next week, or any day on the calendar).
- **Habit page:**
  - this period's check-ins, with undo;
  - current and best streak, and history;
  - pause (with an optional return date) and resume;
  - an optional end (30 days, 8 weeks, a date…), shown as "Day 12 of 30"; at the end, keep going or finish it;
  - edit the habit; delete it (only if it has no check-ins) or archive it (keeps its history).
- **Progress:** a "Your week" card (tap a day to see what you did), a month-by-month **calendar** back to your first habit, and active, finished and archived habits by category, each with its last 7 days as dots. Finished habits can start again.
- **Onboarding:** name, detected time zone and week start, then pick up to 3 habits to start with.
- **Fair streaks:**
  - Periods follow your time zone and your week start (Sunday or Monday).
  - A pause never breaks a streak.
  - A habit started mid-week doesn't count as missed.
- **Groups and kids:**
  - groups (family, friends, couple, roommates) with invite links and emoji avatars;
  - habits done together: a period is done when everyone required has checked in, with optional approval by another adult;
  - kids without a login: an adult checks in for them, or they tap in a kid view; each approved check-in is a star, and the week's stars grow a garden (or an aquarium, space, a dino egg or a town);
  - treat goals chosen with the child ("20 ⭐ for a trip to the zoo"), and a reset that keeps only the nickname and avatar;
  - an Inbox for activity, nudges and cheers, updating live.

<p align="center">
  <img src="docs/screenshots/habit.png" width="220" alt="A habit's page: today's check-in with undo, streaks, history">
  <img src="docs/screenshots/new-habit.png" width="220" alt="New habit: categories and ready-made templates">
  <img src="docs/screenshots/kid-view.png" width="220" alt="The kid view: big buttons, stars and a garden">
</p>

## Interesting problems

**Who is required this period?** A group habit is done when everyone required has checked in, so "required" has to be exact. An adult counts if they were a member from the start of the period (or from the habit's creation, in its first period). A member pause that touches the period excuses them, but a period that everyone required finished is still `done`. With approval on, a period can't be finalized at its end: a pending check-in can be reviewed until period end plus 12 hours in the group's time zone, and until then the period shows as open, so a streak never flickers. All of it lives in one SQL function, `period_outcome`, covered by pgTAP.

**Kids without accounts under RLS.** A child is a `profiles` row with no `auth.users` entry, so `auth.uid()` can never be the child. Adults act for them through one function, `can_act_for_profile`, that RLS and the RPCs share. Nobody can read another person's `profiles` row (it holds time zone and reminder hour), so names and avatars reach the screens only through `SECURITY DEFINER` functions that check group membership first. The one function callable without signing in is the invite preview, and a test fails if there is a second.

## Roadmap

| Milestone | What | Status |
|---|---|---|
| M1 | Foundation: auth (Google, email and password), profiles, CI, staging deploys, versioning | ✅ v0.2.0 |
| M2 | Private habits: templates, check-ins, streaks, pauses, habit page, progress, weekly overview, onboarding | ✅ v0.3.0 |
| M3 | Groups and family: shared habits, approvals, kid profiles with a star garden, emoji avatars, backups | ✅ v0.4.0 |
| M4 | Installable app (PWA), push reminders, offline check-ins | 🚧 In progress: installable app and push reminders on staging; offline check-ins next |
| M5 | XP, levels, badges, rest days, weekly recaps | Planned |
| M6 | Landing page, "Try it" demo, privacy page and data export → **v1.0.0** | Planned |

## How it's built

Next.js 16 (App Router, Server Actions) on Vercel · Supabase (Postgres with Row Level Security, Auth) · Tailwind CSS + shadcn/ui · Vitest, pgTAP and Playwright in GitHub Actions · releases via release-please.

- **The database is the security boundary.** Every table has Row Level Security, and there's a test that proves it. Rules like "one check-in per day on a weekly habit" or "no check-in past the target" live in Postgres functions, and clients can never send a time.
- **Tests at every layer:**
  - pgTAP for the rules and permissions;
  - Vitest for pure logic;
  - Playwright end-to-end tests on a phone viewport, including a guard that every template tab fits on an iPhone SE screen.
- **Flow:** `feature/*` → PR → `develop` (staging) → release PR → `main` (production).

More: [Architecture](docs/architecture.md) (request path, security layers, scaling) · [Design](docs/design.md) (colours, type, motion, voice) · [Decisions](docs/decisions/README.md) (why things are the way they are).

## Run locally

Requires Node 24+ and Docker.

```bash
npm install
npx supabase start          # local Postgres, Auth, Studio (:54323), Mailpit (:54324)
node scripts/local-env.mjs  # writes .env.local
npm run dev                 # http://localhost:3000
```

Tests: `npm test` · `npx supabase test db` · `npm run e2e`

README screenshots: `npm run readme:screenshots` (local stack; seeds a demo month, macOS `sips` resizes).
