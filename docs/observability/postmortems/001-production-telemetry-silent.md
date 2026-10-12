# Postmortem 001: production telemetry went silent (staged)

**Date:** 2026-10-12 · **Type:** planned game day · **Severity:** low (users unaffected) · **Status:** resolved

Times are Israel time (UTC+3), as Grafana showed them.

## Summary
To test the alerts, production's OTLP endpoint was changed to a wrong path (`…/otlp-broken`) and redeployed. This is the failure from the [silent 404](../README.md#incident-the-silent-404-2026-10-07) on staging, which nothing caught at the time. The app kept working; its traces and events stopped reaching Grafana. The **Production telemetry silent** alert emailed 32 minutes after the last trace. Restoring the variable and redeploying brought traces back in 3 minutes.

## Impact
- **Users:** none. The uptime check stayed green throughout (`/api/celebrations` answered 401 as expected).
- **Lost data:** about 40 minutes of production traces and events (14:21 to 15:01). A new visitor in that window would not have triggered **Someone new arrived**.
- **Not affected:** browser telemetry (Faro has its own URL), Supabase metrics (Grafana pulls them, the app doesn't push them), the uptime check.

## Timeline
| Time | Event |
|---|---|
| 14:15 | `OTEL_EXPORTER_OTLP_ENDPOINT` on `keepup-prod` set to `…/otlp-broken`, redeployed |
| 14:21 | Last production trace arrives |
| 14:21 to 14:53 | Infra dashboard: requests fall to 0; error rate and server errors stay at a green 0 |
| 14:53 | Email: **Production telemetry silent** (detection) |
| 14:58 | Fix started: variable restored, redeployed |
| 15:01 | Traces arrive again (recovery) |
| 15:07 | Email: **[RESOLVED] Production telemetry silent** |

**Time to detect:** 32 min from the last trace. **Time to recover:** 3 min from the start of the fix. **Blind for:** 40 min.

## What happened
`@vercel/otel` 2.1.3 treats a 404 (and a 401) from the collector as success, so the app can't notice that its telemetry is gone; nothing errors, nothing is logged at `warn`. Detection has to come from the other end. The rule counts production spans over 30 minutes and fires below 1, with no data counting as firing. The uptime check calls production every 5 minutes, so production always has traffic: silence means the pipeline is broken, not that nobody is using the app.

The last trace came 6 minutes after the redeploy. The cause of that tail wasn't investigated (most likely tabs opened before the redeploy still talked to the old deployment).

## What went well
- The alert fired with no false start: Normal → Pending → Firing, then back to Normal on its own, with a resolved email 6 minutes after recovery.
- The failure was found from outside the app, which is the only place it can be seen.
- Separate pipelines (push for traces, pull for database metrics, a separate browser collector) meant the database tiles kept working during the outage.

## What went badly
- **The dashboard looked healthy while blind.** "Error rate 0.0%" and "Server errors 0" are green when no data arrives, the same as when nothing fails. Only requests per minute dropping to 0 showed the problem.
- **The change left no marker.** A redeploy from the Vercel dashboard bypasses CI, so no `keepup.deployed` event and no line on the dashboard; the cause had to be known, not seen.

## Action items
| # | Action | Why |
|---|---|---|
| 1 | Show the RED tiles as "No data" instead of a green 0 when no spans arrive. **Done:** "No traffic" on error rate and p95, and a Heartbeat tile | A blind dashboard shouldn't look healthy |
| 2 | Change production's variables only with a deploy through the Release workflow, or add a marker by hand (`scripts/change-event.sh keepup.deployed …`). **Done:** written in [Configuration](../README.md#configuration-vercel) | Every change should be visible on the dashboard |
| 3 | Keep the 30-minute window | Shorter detects sooner but fires on quiet nights; 32 minutes is acceptable for a family app |

## Lessons
- An app can't report the loss of its own telemetry; watch the pipeline from the receiving end, with a heartbeat (the uptime check) so silence has one meaning.
- Zero errors and no data look the same. Alert and display on traffic, not only on errors.
- Practice the failure you already had once: the 404 that went unnoticed on 2026-10-07 was caught in 32 minutes on 2026-10-12.
