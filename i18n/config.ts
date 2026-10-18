import { enabledLocales as parseEnabled, type Locale } from "@/supabase/functions/_shared/i18n";
export type { Locale };
export const LOCALE_COOKIE = "locale";

// Which languages people can pick: production stays "en" until the release (plans/2026-10-15).
export function enabledLocales(raw: string | undefined = process.env.KEEPUP_LOCALES): Locale[] {
  return parseEnabled(raw);
}

export function asLocale(v: unknown, enabled: Locale[]): Locale | null {
  return typeof v === "string" && (enabled as string[]).includes(v) ? (v as Locale) : null;
}

export function pickLocale(acceptLanguage: string | null, enabled: Locale[]): Locale {
  for (const part of (acceptLanguage ?? "").split(",")) {
    const tag = part.split(";")[0].trim().slice(0, 2).toLowerCase();
    const found = asLocale(tag === "iw" ? "he" : tag, enabled);
    if (found) return found;
  }
  return "en";
}
