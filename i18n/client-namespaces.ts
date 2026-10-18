import type { Messages } from "next-intl";

// The catalog's top-level namespaces that code running in the browser reads. app/layout.tsx sends only
// these to NextIntlClientProvider; everything else (push, badges, recaps, progress, levels…) stays
// on the server. Client code includes "use client" files, hook users (useTranslations/useT) and the
// helpers they hand a translator to (kidTemplateTitle(t, …), <Garden t={t}>), plus validation keys that
// server actions return untranslated (FieldError). lib/i18n/client-namespaces.test.ts keeps this list in step.
export const CLIENT_NAMESPACES = [
  "auth",
  "avatars",
  "categories",
  "celebrations",
  "common",
  "dates",
  "demo",
  "devices",
  "errorPage",
  "errors",
  "feed",
  "garden",
  "groups",
  "habitEnd",
  "habits",
  "inbox",
  "kidThemes",
  "kidView",
  "kids",
  "moved",
  "myData",
  "nav",
  "notificationCategories",
  "notificationSettings",
  "notifications",
  "offline",
  "onboarding",
  "overview",
  "profile",
  "pushSupport",
  "schedule",
  "settings",
  "tabs",
  "templates",
  "today",
  "units",
  "validation",
  "weekOverview",
] as const satisfies readonly (keyof Messages)[];
