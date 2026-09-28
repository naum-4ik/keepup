# Keepup

**Habits, together.**

[![CI](https://github.com/naum-4ik/keepup/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/naum-4ik/keepup/actions/workflows/ci.yml)

A habit tracker that works for one person and for groups: family, friends, roommates. Private habits stay private; group habits belong to the whole group, with check-ins, approvals, streaks, XP and achievements.

**Status:** in development. Try the staging build at **https://keepup-murex.vercel.app**.

## Stack

Next.js 16 (App Router) on Vercel · Supabase (Postgres with Row Level Security, Auth, Realtime) · Tailwind CSS + shadcn/ui · Vitest, pgTAP and Playwright in GitHub Actions.

## Docs

- [Architecture](docs/architecture.md): request path, security layers, scaling path
- [Design](docs/design.md): colors, type, shapes, voice

## Run locally

Requires Node 24+ and Docker.

```bash
npm install
npx supabase start          # local Postgres, Auth, Studio (:54323), Mailpit (:54324)
node scripts/local-env.mjs  # writes .env.local
npm run dev                 # http://localhost:3000
```

Tests: `npm test` · `npx supabase test db` · `npm run e2e`
