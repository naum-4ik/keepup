"use client";
import { useCallback, useMemo, type ReactNode } from "react";
import type { Rich } from "@/lib/list-nodes";
import { useLocale, useTranslations } from "next-intl";
import type { Locale, T } from "@/supabase/functions/_shared/i18n";

// Client components: the provider's translator as a plain T, its rich-text call (with the <bdi> tag), and the locale.
export function useT(): { t: T; rich: Rich; locale: Locale } {
  const tr = useTranslations();
  const locale = useLocale() as Locale;
  // Stable while the translator and locale are, so it is safe in effect and memo dependencies.
  const t = useCallback<T>((k, v) => tr(k as never, v as never), [tr]);
  const rich = useCallback<Rich>((k, v) => tr.rich(k as never, { bdi: (c: ReactNode) => <bdi>{c}</bdi>, ...v } as never), [tr]);
  return useMemo(() => ({ t, rich, locale }), [t, rich, locale]);
}
