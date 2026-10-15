import { createTranslator } from "use-intl/core";
import en from "@/supabase/functions/_shared/messages/en.json";
import type { Locale, T } from "@/supabase/functions/_shared/i18n";

const catalogs: Partial<Record<Locale, Record<string, unknown>>> = { en };
// Tests only: a translator that throws on a missing key or a broken message.
export function tFor(locale: Locale, messages = catalogs[locale]): T {
  if (!messages) throw new Error(`no catalog for ${locale}`);
  const t = createTranslator({ locale, messages, onError: (e) => { throw e; } });
  return (key, values) => t(key as never, values as never);
}
export const tEn = tFor("en");
