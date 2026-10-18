import { createTranslator } from "next-intl";
import { enabledLocales } from "@/i18n/config";
import { deepMerge } from "@/i18n/merge-messages";
import type { OfflinePageCopy } from "@/lib/offline-copy";
import en from "@/supabase/functions/_shared/messages/en.json";
import type { Locale } from "@/supabase/functions/_shared/i18n";
import { OfflineMessage } from "./offline-message";

export const dynamic = "force-static";

// A language's catalog over English (as i18n/request.ts), or null while its file doesn't exist yet.
async function catalog(locale: Locale): Promise<typeof en | null> {
  if (locale === "en") return en;
  try {
    return deepMerge(en, (await import(`../../supabase/functions/_shared/messages/${locale}.json`)).default);
  } catch {
    return null;
  }
}

async function copyFor(locale: Locale): Promise<OfflinePageCopy | null> {
  const messages = await catalog(locale);
  if (!messages) return null;
  const t = createTranslator({ locale, messages, namespace: "offline.page" });
  return { title: t("title"), text: t("text"), openToday: t("openToday") };
}

// What the service worker shows for a page that isn't saved on this phone (ideas/offline.md §3).
// Built once, so it can't read the visitor's language: it carries the words of every enabled language
// (KEEPUP_LOCALES at build time) that has a catalog, and an inline script (lib/offline-copy.ts offlineLocaleScript) picks one in the browser.
export default async function OfflinePage() {
  const found = await Promise.all(enabledLocales().map(async (l) => [l, await copyFor(l)] as const));
  const copies = Object.fromEntries(found.filter(([, c]) => c)) as { en: OfflinePageCopy } & Partial<Record<Locale, OfflinePageCopy>>;
  return <OfflineMessage copies={copies} />;
}
