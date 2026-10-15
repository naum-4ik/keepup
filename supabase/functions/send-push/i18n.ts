// supabase/functions/send-push/i18n.ts
// The recipient's translator. use-intl matches the app's next-intl version (package.json).
import { createTranslator } from "npm:use-intl@4.14.9/core";
import en from "../_shared/messages/en.json" with { type: "json" };
import { LOCALES, type Locale, type T } from "../_shared/i18n.ts";

// ru/he are added to this map in PRs 7 and 8 (one import line each).
const catalogs: Partial<Record<Locale, Record<string, unknown>>> = { en };
const english = createTranslator({ locale: "en", messages: en });

// A key the catalog has renders from it; a missing one renders the English text with the same values.
export function makeTranslator(locale: Locale, messages: Record<string, unknown>): { t: T; locale: Locale } {
  const tr = createTranslator({ locale, messages });
  return {
    locale,
    t: (k, v) => (tr.has(k as never) ? tr(k as never, v as never) : english(k as never, v as never)),
  };
}

// Unknown or missing locale → English.
export function translatorFor(raw: string | undefined | null): { t: T; locale: Locale } {
  const locale = (LOCALES as readonly string[]).includes(raw ?? "") && catalogs[raw as Locale] ? (raw as Locale) : "en";
  return makeTranslator(locale, catalogs[locale]!);
}
