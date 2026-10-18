"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { setChildTheme } from "@/app/(app)/kids/actions";
import { KID_THEMES, themeName } from "@/lib/garden";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

// ideas/kid-view-next.md §2: what grows as the stars come in. Big picture tiles to choose together.
export function ThemePicker({ childId, childName, theme }: { childId: string; childName: string; theme: string }) {
  const { t: tr } = useT();
  const t = useTranslations("kids.theme");
  const [current, setCurrent] = useState(theme);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <section aria-label={t("title")} className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-soft">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-bold text-muted-foreground">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t.rich("hint", { name: childName, bdi: (c) => <bdi>{c}</bdi> })}</p>
      </div>
      <div role="group" aria-label={t("group")} className="grid grid-cols-5 gap-2">
        {KID_THEMES.map((th) => (
          <button
            key={th.id}
            type="button"
            aria-pressed={current === th.id}
            disabled={pending}
            onClick={() => {
              const before = current;
              setCurrent(th.id); // shows at once; put back if the save fails
              setError(null);
              startTransition(async () => {
                const r = await setChildTheme(childId, th.id);
                if (!r.ok) {
                  setCurrent(before);
                  setError(r.message);
                }
              });
            }}
            className={cn(
              "flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-transparent bg-muted/50 p-1 text-center text-[11px] leading-tight font-semibold hover:bg-muted",
              "aria-pressed:border-primary aria-pressed:bg-accent",
            )}
          >
            <span aria-hidden className="text-3xl leading-none">{th.icon}</span>
            {themeName(tr, th.id)}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
