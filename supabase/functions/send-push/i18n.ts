// supabase/functions/send-push/i18n.ts
// The recipient's translator. use-intl matches the app's next-intl version (package.json).
import { createTranslator } from "npm:use-intl@4.14.9/core";
import en from "../_shared/messages/en.json" with { type: "json" };
import ru from "../_shared/messages/ru.json" with { type: "json" };
import { enabledLocales, LOCALES, type Locale, type T } from "../_shared/i18n.ts";

// he is added to this map in PR 8 (one import line).
const catalogs: Partial<Record<Locale, Record<string, unknown>>> = { en, ru };
const english = createTranslator({ locale: "en", messages: en });

// A key the catalog has renders from it; a missing one renders the English text with the same values.
export function makeTranslator(locale: Locale, messages: Record<string, unknown>): { t: T; locale: Locale } {
  const tr = createTranslator({ locale, messages });
  return {
    locale,
    t: (k, v) => (tr.has(k as never) ? tr(k as never, v as never) : english(k as never, v as never)),
  };
}

// A badge's name by code: the catalog's words when it has the code, else the payload's own name (a
// newer database's badge). Mirrors lib/badges.ts badgeName.
const BADGE_CODES = new Set(Object.keys((en as { badges: Record<string, unknown> }).badges));
export const badgeName = (t: T, code: string, fallback: string): string => (BADGE_CODES.has(code) ? t(`badges.${code}.name`) : fallback);

// Unknown, missing or not-enabled locale → English (same KEEPUP_LOCALES gate as the app).
export function translatorFor(
  raw: string | undefined | null,
  enabled: Locale[] = enabledLocales(Deno.env.get("KEEPUP_LOCALES")),
): { t: T; locale: Locale } {
  const locale = (LOCALES as readonly string[]).includes(raw ?? "") && enabled.includes(raw as Locale) && catalogs[raw as Locale] ? (raw as Locale) : "en";
  return makeTranslator(locale, catalogs[locale]!);
}
