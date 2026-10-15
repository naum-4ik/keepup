"use client";
import { useCallback, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale, T } from "@/supabase/functions/_shared/i18n";

// Client components: the provider's translator as a plain T, with its locale.
export function useT(): { t: T; locale: Locale } {
  const tr = useTranslations();
  const locale = useLocale() as Locale;
  // Stable while the translator and locale are, so it is safe in effect and memo dependencies.
  const t = useCallback<T>((k, v) => tr(k as never, v as never), [tr]);
  return useMemo(() => ({ t, locale }), [t, locale]);
}
