# 0002. `develop` is staging, `main` is production

**Status:** Accepted · 2026-09-28

## Context
Keepup is built alone but should be run like a team product. `main` should only ever hold finished releases.

## Decision
- Work happens on `feature/*`, `fix/*` or `docs/*` branches. Each one opens a PR into `develop`, and PRs are squash-merged.
- `develop` deploys to **staging** (Vercel + a staging Supabase project). Database migrations deploy automatically after CI passes.
- release-please keeps a release PR with the next SemVer version and changelog. A release PR `develop` → `main` ships to **production** (from v1.0.0).
- Branch protection: required checks (lint, types, unit, pgTAP, e2e) and a Conventional Commits PR title.
- Until v1.0.0, `develop` is the GitHub default branch, so scheduled and manual workflows can run.

## Consequences
- Every change is reviewed, tested and versioned, and the changelog writes itself from PR titles.
- Cost: more ceremony for tiny changes, and one open PR at a time to avoid endless "update branch" rounds.
