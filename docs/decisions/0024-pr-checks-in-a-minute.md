# 0024. PR checks in about a minute; the slow suites run after the merge and nightly

**Status:** Accepted · 2026-10-07

## Context
Every PR waited 10–12 minutes for CI. Lint, types, unit and Edge Function tests took under a minute; the rest was starting a local Supabase (~1.5 min), the pgTAP tests (~35 s) and the Playwright suite (~8 min). For a solo project merging many small PRs a day, the wait cost more than the late feedback it prevented.

## Decision
- **Every PR:** lint, types, unit tests (`checks`) and the Edge Function tests (`functions`). About 50 seconds.
- **A merge (push to `develop` or `main`):** pgTAP and the generated-types check as well. The staging deploy waits on this run, so no migration reaches staging untested.
- **Nightly (01:37 UTC), on demand, and on a PR labelled `full-ci`:** pgTAP and the full Playwright suite.
- The `integration` job stays a required check; on an ordinary PR it's skipped, and a skipped job counts as passed.

## Consequences
- A broken e2e flow is found by the next nightly run (GitHub emails the owner), not before the merge. A broken database rule is found after the merge, but still before staging.
- Risky changes (migrations, RLS, offline, auth) should carry the `full-ci` label to run everything before the merge.
- Supersedes the "e2e on every PR" part of the 2026-10-01 CI choice.
