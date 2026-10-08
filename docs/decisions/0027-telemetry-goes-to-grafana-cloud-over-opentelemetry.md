# 0027. Telemetry goes to Grafana Cloud over OpenTelemetry, through one redacted path

**Status:** Accepted · 2026-10-07

## Context
Errors and slow requests were visible only in Vercel's request logs, kept for a short time and with no link between a request and its database calls. Vercel's log drains need a paid plan. Keepup stays on free tiers.

## Decision
- The app exports **OTLP straight to Grafana Cloud's free tier** (Tempo for traces, Loki for events), using `@vercel/otel` in `instrumentation.ts`. No collector.
- **One explicit export path** per signal, built in `lib/telemetry.ts`, with redaction before export. Never `@vercel/otel`'s `"auto"` export, which adds an unredacted second exporter when the endpoint variable is set.
- **Events, not clicks:** one wide event per meaningful action (`keepup.check_in`, …), carrying the trace ID.
- Telemetry carries user identity (ID, email), habit names and children's nicknames: at family scale the owner wants the detail. It never carries secrets; a test enforces it.

## Consequences
- One click from an event to its trace and back. Vendor-neutral: another backend is two environment variables.
- Grafana Labs (EU) becomes a processor of personal data: the privacy policy must say so before the app opens to strangers (M6).
- The SDK reports export failures as success, so a broken pipeline is caught by an alert on missing data, not by the app.
- Replaces "error monitoring: Vercel logs only".
