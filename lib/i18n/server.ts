import "server-only";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale, T } from "@/supabase/functions/_shared/i18n";

// Server components and actions: the request's translator as a plain T, with its locale.
export async function getT(): Promise<{ t: T; locale: Locale }> {
  const [tr, locale] = await Promise.all([getTranslations(), getLocale()]);
  return { t: (k, v) => tr(k as never, v as never), locale: locale as Locale };
}
