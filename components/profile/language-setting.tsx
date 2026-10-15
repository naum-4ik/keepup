"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { setLanguage } from "@/app/(app)/profile/settings/actions";
import type { Locale } from "@/i18n/config";
import { isRtl } from "@/supabase/functions/_shared/i18n";

const pillClass =
  "relative flex h-11 cursor-pointer items-center justify-center rounded-full border border-border px-2 text-sm font-semibold has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring";

// Settings → Language: the profile keeps it for every device; the saved offline pages are in the old
// language, so the service worker drops them before the page re-renders.
export function LanguageSetting({ current, enabled }: { current: Locale; enabled: Locale[] }) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [value, setValue] = useState<Locale>(current);
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    const before = value;
    setValue(next);
    startTransition(async () => {
      const r = await setLanguage(next);
      if (!r.ok) return setValue(before);
      navigator.serviceWorker?.controller?.postMessage({ type: "clear-pages" });
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="language-label" className="flex flex-col gap-3 rounded-2xl bg-card p-6 shadow-soft">
      <h2 id="language-label" className="text-base font-bold">{t("language")}</h2>
      <p className="text-sm text-muted-foreground">{t("languageHint")}</p>
      <div role="radiogroup" aria-labelledby="language-label" className={`grid gap-2 ${enabled.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {enabled.map((code) => (
          <label key={code} lang={code} dir={isRtl(code) ? "rtl" : "ltr"} className={pillClass}>
            <input type="radio" name="language" value={code} checked={value === code} disabled={pending}
              onChange={() => choose(code)} className="absolute inset-0 cursor-pointer appearance-none rounded-full opacity-0" />
            {t(`languageNames.${code}`)}
          </label>
        ))}
      </div>
    </section>
  );
}
