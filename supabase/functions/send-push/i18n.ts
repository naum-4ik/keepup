// supabase/functions/send-push/i18n.ts
// The recipient's translator. use-intl matches the app's next-intl version (package.json).
import { createTranslator } from "npm:use-intl@4.14.9/core";
import en from "../_shared/messages/en.json" with { type: "json" };
import { LOCALES, type Locale, type T } from "../_shared/i18n.ts";

// ru/he are added to this map in PRs 7 and 8 (one import line each).
const catalogs: Partial<Record<Locale, Record<string, unknown>>> = { en };
const english = createTranslator({ locale: "en", messages: en });

// Unknown or missing locale → English; a key missing from a translation → its English text.
export function translatorFor(raw: string | undefined | null): { t: T; locale: Locale } {
  const locale = (LOCALES as readonly string[]).includes(raw ?? "") && catalogs[raw as Locale] ? (raw as Locale) : "en";
  const tr = createTranslator({
    locale,
    messages: catalogs[locale]!,
    onError: () => {},
    getMessageFallback: ({ key, namespace }) => english([namespace, key].filter(Boolean).join(".") as never),
  });
  return { locale, t: (k, v) => tr(k as never, v as never) };
}
