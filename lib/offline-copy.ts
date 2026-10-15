// lib/offline-copy.ts
// The offline UI's two sentences with a value in them. The rest of its words are in the catalog
// (offline.*, ideas/offline.md §3). Feed notes live in the shared copy sheet.
import { LOCALE_COOKIE, asLocale, pickLocale } from "@/i18n/config";
import { isolate, type Locale, type T } from "@/supabase/functions/_shared/i18n";

export const undoLabel = (t: T, habit: string): string => t("offline.undoLabel", { habit: isolate(habit) });

// Sign-out with check-ins still on the phone (lib/push-support.ts signOutWithQueue). `count` is a
// string so a large number isn't grouped by the formatter.
export const unsavedSignOut = (t: T, n: number): string => t("offline.unsavedSignOut", { n, count: String(n) });

// /offline is built once (force-static, the service worker's fallback page), so it carries the words in
// every language this build has and picks one in the browser: the device's locale cookie, then the
// phone's language (two letters, iw → he), then English.
export type OfflinePageCopy = { title: string; text: string; openToday: string };

export function offlinePageLocale(cookie: string, phoneLanguage: string | undefined, available: Locale[]): Locale {
  const prefix = `${LOCALE_COOKIE}=`;
  const fromCookie = cookie.split(";").map((c) => c.trim()).find((c) => c.startsWith(prefix))?.slice(prefix.length);
  return asLocale(fromCookie, available) ?? pickLocale(phoneLanguage ?? null, available);
}
