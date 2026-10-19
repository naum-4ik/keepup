"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { setCelebrations } from "@/app/(app)/profile/settings/actions";
import { SettingStatus, useSettingSave } from "@/components/profile/setting-status";
import { Section } from "@/components/ui/section";
import type { CelebrationMode } from "@/lib/celebrations";

const pillClass =
  "relative flex h-11 cursor-pointer items-center justify-center rounded-full border border-border px-inner text-sm font-semibold has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring has-disabled:cursor-default has-disabled:opacity-60";

// §9: Full plays a short full-screen moment with confetti for level-ups and new badges; Subtle shows a
// small card instead. Check-in bounce and haptics stay either way; reduced motion is always respected.
// Saves on change (components/profile/setting-status.tsx).
export function CelebrationsSetting({ saved }: { saved: CelebrationMode }) {
  const t = useTranslations("settings.celebrations");
  const [value, setValue] = useState<CelebrationMode>(saved);
  const { state, pending, save } = useSettingSave();

  function choose(next: CelebrationMode) {
    const before = value;
    setValue(next);
    save(() => setCelebrations(next), { failed: () => setValue(before) });
  }

  return (
    <Section title={t("title")}>
      {/* The heading's hint: 8 px under it (inner level), not the section's 16. */}
      <p className="-mt-inner text-sm text-muted-foreground">{t("hint")}</p>
      <div role="radiogroup" aria-label={t("title")} aria-describedby="celebrations-hint celebrations-status" className="grid grid-cols-2 gap-inner">
        {(["full", "subtle"] as const).map((mode) => (
          <label key={mode} className={pillClass}>
            <input type="radio" name="celebrations" value={mode} checked={value === mode} disabled={pending}
              onChange={() => choose(mode)} className="absolute inset-0 cursor-pointer appearance-none rounded-full opacity-0" />
            {t(mode)}
          </label>
        ))}
      </div>
      {/* What the picked one does, 8 px under the pills (inner level). */}
      <p id="celebrations-hint" className="-mt-inner text-xs text-muted-foreground">
        {t(value === "full" ? "fullHint" : "subtleHint")}
      </p>
      <SettingStatus state={state} id="celebrations-status" />
    </Section>
  );
}
