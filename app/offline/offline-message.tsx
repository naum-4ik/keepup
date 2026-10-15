"use client";

import { CloudOff } from "lucide-react";
import { useSyncExternalStore } from "react";
import { offlinePageLocale, type OfflinePageCopy } from "@/lib/offline-copy";
import { isRtl, type Locale } from "@/supabase/functions/_shared/i18n";

// The words come in every language the build has (app/offline/page.tsx); the browser picks one.
// The prerendered HTML is English; after hydration it switches (no hydration mismatch).
const noSubscribe = () => () => {};

export function OfflineMessage({ copies }: { copies: { en: OfflinePageCopy } & Partial<Record<Locale, OfflinePageCopy>> }) {
  const locale = useSyncExternalStore(
    noSubscribe,
    () => offlinePageLocale(document.cookie, navigator.languages?.join(",") || navigator.language, Object.keys(copies) as Locale[]),
    (): Locale => "en",
  );
  const copy = copies[locale] ?? copies.en;
  return (
    <main
      lang={locale}
      dir={isRtl(locale) ? "rtl" : "ltr"}
      className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-accent text-primary">
        <CloudOff aria-hidden className="size-6" />
      </div>
      <h1 className="text-xl font-bold">{copy.title}</h1>
      <p className="text-sm text-muted-foreground">{copy.text}</p>
      {/* A plain link, not next/link: a full page load is what the worker answers from its saved copy. */}
      <a href="/today" className="flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline">
        {copy.openToday}
      </a>
    </main>
  );
}
