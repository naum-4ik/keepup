// lib/offline-copy.ts
// The offline UI's two sentences with a value in them. The rest of its words are in the catalog
// (offline.*, ideas/offline.md §3). Feed notes live in the shared copy sheet.
import { isolate, type Locale, type T } from "@/supabase/functions/_shared/i18n";

export const undoLabel = (t: T, habit: string): string => t("offline.undoLabel", { habit: isolate(habit) });

// Sign-out with check-ins still on the phone (lib/push-support.ts signOutWithQueue). `count` is a
// string so a large number isn't grouped by the formatter.
export const unsavedSignOut = (t: T, n: number): string => t("offline.unsavedSignOut", { n, count: String(n) });

// /offline is built once (force-static, the service worker's fallback page), so it carries the words in
// every language this build has and picks one in the browser: the device's locale cookie, then the
// phone's languages in order (navigator.languages joined with ",", read like Accept-Language: two
// letters, iw → he), then English.
export type OfflinePageCopy = { title: string; text: string; openToday: string };

// Self-contained on purpose (no imports, no outside names): offlineLocaleScript sends its source to the
// page as an inline script. Same rules as i18n/config.ts asLocale/pickLocale and the "locale" cookie
// (LOCALE_COOKIE); lib/offline-copy.test.ts holds it to them.
export function offlinePageLocale(cookie: string, phoneLanguages: string | undefined, available: Locale[]): Locale {
  const has = (v: string | undefined): v is Locale => v !== undefined && (available as string[]).includes(v);
  const fromCookie = cookie.split(";").map((c) => c.trim()).find((c) => c.startsWith("locale="))?.slice(7);
  if (has(fromCookie)) return fromCookie;
  for (const part of (phoneLanguages ?? "").split(",")) {
    const tag = part.split(";")[0].trim().slice(0, 2).toLowerCase();
    const found = tag === "iw" ? "he" : tag;
    if (has(found)) return found;
  }
  return "en";
}

// The offline page's language, set before it paints (no frame of English first) and without React, so
// it works even if the page's scripts never load: the script marks its parent with data-locale, and the
// page's CSS shows that language's copy (app/offline/offline-message.tsx). No script: English.
export const offlineLocaleScript = (available: Locale[]): string =>
  `try{document.currentScript.parentNode.setAttribute("data-locale",(${offlinePageLocale.toString()})(document.cookie,(navigator.languages&&navigator.languages.join(","))||navigator.language,${JSON.stringify(available)}))}catch(e){}`;
