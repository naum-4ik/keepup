import { CloudOff } from "lucide-react";
import { offlineLocaleScript, type OfflinePageCopy } from "@/lib/offline-copy";
import { isRtl, type Locale } from "@/supabase/functions/_shared/i18n";

// The words come in every language the build has (app/offline/page.tsx), one <main> each. A tiny inline
// script picks the language while the page loads, before it paints, so there is no frame of English
// first; CSS shows only that one (hidden ones are out of the accessibility tree too). No React state, so
// it works even if the page's scripts never load; without the script it stays English.
export function OfflineMessage({ copies }: { copies: { en: OfflinePageCopy } & Partial<Record<Locale, OfflinePageCopy>> }) {
  const locales = Object.keys(copies) as Locale[];
  const css = [
    "[data-offline]>main{display:none}",
    "[data-offline]:not([data-locale])>main[lang=en]{display:flex}",
    ...locales.map((l) => `[data-offline][data-locale=${l}]>main[lang=${l}]{display:flex}`),
  ].join("");
  return (
    // The script sets data-locale on this element before hydration: not a mismatch to report.
    <div data-offline="" suppressHydrationWarning>
      <style>{css}</style>
      <script dangerouslySetInnerHTML={{ __html: offlineLocaleScript(locales) }} />
      {locales.map((locale) => {
        const copy = copies[locale]!;
        return (
          <main
            key={locale}
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
      })}
    </div>
  );
}
