"use client";
import { useLocale, useTranslations } from "next-intl";
import type { Locale, T } from "@/supabase/functions/_shared/i18n";

// Client components: the provider's translator as a plain T, with its locale.
export function useT(): { t: T; locale: Locale } {
  const tr = useTranslations();
  return { t: (k, v) => tr(k as never, v as never), locale: useLocale() as Locale };
}
