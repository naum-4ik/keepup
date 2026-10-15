import "server-only";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { Rich } from "@/lib/list-nodes";
import type { Locale, T } from "@/supabase/functions/_shared/i18n";

// Server components and actions: the request's translator as a plain T, with its locale.
export async function getT(): Promise<{ t: T; rich: Rich; locale: Locale }> {
  const [tr, locale] = await Promise.all([getTranslations(), getLocale()]);
  return {
    t: (k, v) => tr(k as never, v as never),
    rich: (k, v) => tr.rich(k as never, { bdi: (c: ReactNode) => <bdi>{c}</bdi>, ...v } as never),
    locale: locale as Locale,
  };
}
