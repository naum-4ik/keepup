"use client";

import { useState, useTransition } from "react";
import { setChildTheme } from "@/app/(app)/kids/actions";
import { KID_THEMES } from "@/lib/garden";
import { cn } from "@/lib/utils";

// ideas/kid-view-next.md §2: what grows as the stars come in. Big picture tiles to choose together.
export function ThemePicker({ childId, childName, theme }: { childId: string; childName: string; theme: string }) {
  const [current, setCurrent] = useState(theme);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <section aria-label="What grows" className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-soft">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-bold text-muted-foreground">What grows</h2>
        <p className="text-sm text-muted-foreground">Choose it with {childName}. The stars stay the same.</p>
      </div>
      <div role="group" aria-label="Theme" className="grid grid-cols-5 gap-2">
        {KID_THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={current === t.id}
            disabled={pending}
            onClick={() => {
              const before = current;
              setCurrent(t.id); // shows at once; put back if the save fails
              setError(null);
              startTransition(async () => {
                const r = await setChildTheme(childId, t.id);
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
            <span aria-hidden className="text-3xl leading-none">{t.icon}</span>
            {t.name}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
