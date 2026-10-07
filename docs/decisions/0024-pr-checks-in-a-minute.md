# 0024. PR checks in about a minute; the slow suites run after the merge

**Status:** Accepted · 2026-10-07

## Context
Every PR waited 10–12 minutes for CI. Lint, types, unit and Edge Function tests took under a minute; the rest was starting a local Supabase (~1.5 min), the pgTAP tests (~35 s) and the Playwright suite (~8 min). For a solo project merging many small PRs a day, the wait cost more than the late feedback it prevented.

## Decision
- **Every PR:** lint, types, unit tests (`checks`) and the Edge Function tests (`functions`). About 50 seconds, required.
- **Every PR, alongside:** one sanity e2e test through a real database (`sanity`: sign up, add a habit, check in, reload). About 3 minutes, not required, so it never holds up a merge.
- **A merge (push to `develop` or `main`):** pgTAP and the generated-types check. The staging deploy waits on this run, so no migration reaches staging untested.
- **After each merge to `develop`:** the full Playwright suite in its own workflow (`e2e.yml`). It blocks nothing; a failure points to that one merge and GitHub emails the owner.
- **A PR labelled `full-ci`, or a manual run:** pgTAP and the full Playwright suite before the merge.
- The `integration` job stays a required check; on an ordinary PR it's skipped, and a skipped job counts as passed.

## Consequences
- A broken core flow shows on the PR within minutes (the sanity test). Anything else in the e2e suite is found about 10 minutes after the merge, attributed to that merge. A broken database rule is found after the merge, but still before staging.
- Risky changes (migrations, RLS, offline, auth) should carry the `full-ci` label to run everything before the merge.
- Supersedes the "e2e on every PR" part of the 2026-10-01 CI choice.
