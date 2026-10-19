"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { finishHabit, keepGoing } from "@/app/(app)/habits/actions";
import { Confetti } from "@/components/celebrations/confetti";
import { HabitEmoji } from "@/components/habits/category-icon";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { takeBurstTurn } from "@/lib/burst-turns";
import type { HabitCategory } from "@/lib/habit-schema";
import { isolate } from "@/supabase/functions/_shared/i18n";

const seenKey = (habitId: string, endsOn: string) => `keepup:finish-celebrated:${habitId}:${endsOn}`;

function seen(key: string): boolean {
  try {
    return Boolean(localStorage.getItem(key));
  } catch {
    return false; // Private mode: celebrate anyway, it just may repeat.
  }
}

function markSeen(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Private mode: nothing to remember it in.
  }
}

// ideas/habit-end-date.md: a habit reached its end. Celebrate what was done (at least half), then Keep going (the end
// is removed) or Finish (to the Finished list). Only the owner, or an admin for a group habit, decides.
// The confetti plays once per habit and end on this device (the card can stay for days, e.g. for a
// member waiting on an admin), and not when another celebration is on screen (`quiet`). Two finish
// cards each play theirs, in turn (lib/burst-turns.ts), as do the other bursts.
export function FinishCard({
  habitId,
  endsOn,
  title,
  emoji,
  category,
  line,
  celebrate,
  quiet = false,
  canDecide,
}: {
  habitId: string;
  endsOn: string;
  title: string;
  emoji: string | null;
  category: HabitCategory | null;
  line: string;
  celebrate: boolean;
  quiet?: boolean;
  canDecide: boolean;
}) {
  const t = useTranslations("today.finish");
  const [confetti, setConfetti] = useState(false);
  useEffect(() => {
    const key = seenKey(habitId, endsOn);
    if (!celebrate || quiet || seen(key)) return;
    const turn = takeBurstTurn();
    let played = false;
    const timer = window.setTimeout(() => {
      played = true;
      markSeen(key);
      setConfetti(true);
    }, turn.wait);
    return () => {
      window.clearTimeout(timer);
      // Gone before its turn: hand the turn back if nobody queued behind it.
      if (!played) turn.release();
    };
  }, [celebrate, quiet, habitId, endsOn]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: (id: string) => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      const r = await fn(habitId);
      if (!r.ok) setError(r.message ?? null);
    });

  return (
    // A headed decision, not a card (docs/design.md "Sections"): the habit and what it reached, then
    // its two actions. overflow-x-clip: the confetti never widens the page.
    <section aria-label={t("label", { title: isolate(title) })} className="relative flex flex-col gap-item overflow-x-clip">
      {confetti && <Confetti />}
      {/* Above the confetti, so the pieces pass behind the text. */}
      <div className="relative z-10 flex items-center gap-inner">
        <HabitEmoji category={category} emoji={emoji} />
        <div className="flex min-w-0 flex-col">
          <p className="truncate font-bold">{t.rich("reachedEnd", { title, celebrate: celebrate ? "yes" : "no", bdi: (c) => <bdi>{c}</bdi> })}</p>
          <p className="text-sm text-done">{line}</p>
        </div>
      </div>
      {canDecide ? (
        <div className="relative z-10 flex gap-inner">
          <Button type="button" variant="outline" className="h-11 flex-1" disabled={pending} onClick={() => run(finishHabit)}>
            {t("finish")}
          </Button>
          <Button type="button" className="h-11 flex-1" disabled={pending} onClick={() => run(keepGoing)}>
            {t("keepGoing")}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("adminChooses")}</p>
      )}
      {error && (
        <Notice tone="error" live>
          {error}
        </Notice>
      )}
    </section>
  );
}
