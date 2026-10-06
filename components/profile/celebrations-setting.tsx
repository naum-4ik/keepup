"use client";

import { useState, useTransition } from "react";
import { setCelebrations } from "@/app/(app)/profile/settings/actions";
import type { CelebrationMode } from "@/lib/celebrations";

const pillClass =
  "relative flex h-11 cursor-pointer items-center justify-center rounded-full border border-border px-2 text-sm font-semibold has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring";

// §9: Full plays a short full-screen moment with confetti for level-ups and new badges; Subtle shows a
// small card instead. Check-in bounce and haptics stay either way; reduced motion is always respected.
export function CelebrationsSetting({ saved }: { saved: CelebrationMode }) {
  const [value, setValue] = useState<CelebrationMode>(saved);
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  function choose(next: CelebrationMode) {
    const before = value;
    setValue(next);
    setNote(null);
    startTransition(async () => {
      const r = await setCelebrations(next);
      setNote(r.ok ? "Saved" : r.message);
      if (!r.ok) setValue(before);
    });
  }

  return (
    <section aria-label="Celebrations settings" className="flex flex-col gap-3 rounded-2xl bg-card p-6 shadow-soft">
      <h2 id="celebrations-label" className="text-base font-bold">Celebrations</h2>
      <p className="text-sm text-muted-foreground">How level-ups and new badges appear.</p>
      <div role="radiogroup" aria-labelledby="celebrations-label" className="grid grid-cols-2 gap-2">
        {([["full", "Full"], ["subtle", "Subtle"]] as const).map(([mode, label]) => (
          <label key={mode} className={pillClass}>
            <input type="radio" name="celebrations" value={mode} checked={value === mode} disabled={pending}
              onChange={() => choose(mode)} className="absolute inset-0 cursor-pointer appearance-none rounded-full opacity-0" />
            {label}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {value === "full" ? "A short full-screen moment with confetti." : "A small card at the bottom, no confetti."}
      </p>
      {/* aria-live, not role="status": Settings' profile form already has the page's one status ("Saved"), which e2e reads. */}
      <p aria-live="polite" className="min-h-4 text-xs text-muted-foreground">{note}</p>
    </section>
  );
}
