"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { setLanguage } from "@/app/(app)/profile/settings/actions";
import { SettingStatus, useSettingSave } from "@/components/profile/setting-status";
import { Section } from "@/components/ui/section";
import type { Locale } from "@/i18n/config";
import { isRtl } from "@/supabase/functions/_shared/i18n";

const pillClass =
  "relative flex h-11 cursor-pointer items-center justify-center rounded-full border border-border px-inner text-sm font-semibold has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring has-disabled:cursor-default has-disabled:opacity-60";

// Settings → Language: the profile keeps it for every device; the saved offline pages are in the old
// language, so the service worker drops them before the page re-renders. While it saves the pills
// wait and the line says "Saving…"; then the page comes back in the new language with "Saved ✓".
// Not saved: the saved language is picked again, and the line says why and what to do.
export function LanguageSetting({ current, enabled }: { current: Locale; enabled: Locale[] }) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [value, setValue] = useState<Locale>(current);
  const { state, pending, save } = useSettingSave<Locale>(current);

  function choose(next: Locale) {
    setValue(next);
    save(next, () => setLanguage(next), {
      saved: () => {
        navigator.serviceWorker?.controller?.postMessage({ type: "keepup:clear-pages" });
        router.refresh();
      },
      revert: setValue,
    });
  }

  return (
    <Section title={t("language")}>
      {/* The heading's hint: 8 px under it (inner level), not the section's 16. */}
      <p className="-mt-inner text-sm text-muted-foreground">{t("languageHint")}</p>
      <div role="radiogroup" aria-label={t("language")} aria-describedby="language-status" className={`grid gap-inner ${enabled.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {enabled.map((code) => (
          <label key={code} lang={code} dir={isRtl(code) ? "rtl" : "ltr"} className={pillClass}>
            <input type="radio" name="language" value={code} checked={value === code} disabled={pending}
              onChange={() => choose(code)} className="absolute inset-0 cursor-pointer appearance-none rounded-full opacity-0" />
            {t(`languageNames.${code}`)}
          </label>
        ))}
      </div>
      <SettingStatus state={state} id="language-status" />
    </Section>
  );
}
