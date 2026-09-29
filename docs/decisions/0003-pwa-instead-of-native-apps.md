# 0003. A PWA instead of native apps

**Status:** Accepted · 2026-09-28

## Context
The family uses iPhones and Android. Keepup needs to feel like an app (home screen, notifications) without two app-store codebases.

## Decision
Ship one Next.js web app as an installable PWA. It adds to the home screen, uses Web Push (iOS 16.4+ once installed), and a service worker for offline check-ins. No React Native or Swift/Kotlin apps in v1.

## Consequences
- One codebase, instant deploys, and no app-store review. Staging and production are just URLs.
- iOS needs "Add to Home Screen" before push works, so onboarding has to explain it. Some native features (widgets, Health data) aren't available.
- A native wrapper stays possible later if it's ever needed.
