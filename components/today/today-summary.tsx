"use client";

import Link from "next/link";
import { ChevronRight, Flame } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Confetti } from "@/components/celebrations/confetti";
import { useOfflineQueue } from "@/components/offline/offline-queue-provider";
import { ProgressRing } from "@/components/overview/week-overview";
import { useT } from "@/lib/i18n/client";
import { goalsMet } from "@/lib/week-overview";
import { takeBurstTurn } from "@/lib/burst-turns";
import { todayLine, todayProgress, todayStreak, withQueuedProgress, type ProgressHabit } from "@/lib/today-progress";
import { cn } from "@/lib/utils";

const SEEN_KEY = "keepup:all-done-celebrated";

// The top of Today (ideas/today-card.md), a line and not a card (docs/design.md "Surfaces": a single
// stat is a line of text): today's ring and one sentence that moves with you ("1 of 3 done. Check in 2
// more to finish today."), then this week in one link. Kept short so the first check-in sits high on a
// small phone. The last check-in of the day gets a small confetti burst, once per day on this device
// (the day counts as celebrated even when quiet). Taps still waiting on this phone (offline) count
// too, as the check-ins they will be.
export function TodaySummary({
  dayKey,
  habits,
  week,
  quiet = false,
}: {
  dayKey: string;
  // Today's adult habits, as the page lists them (lib/today-progress.ts todayProgress).
  habits: ProgressHabit[];
  week: { done: number; possible: number; streak: number } | null;
  // Another celebration (e.g. "Everyone did it") is already on screen: don't burst twice.
  quiet?: boolean;
}) {
  const { t } = useT();
  const { delta } = useOfflineQueue();
  const { done, total } = useMemo(() => todayProgress(withQueuedProgress(habits, delta)), [habits, delta]);
  const allDone = total > 0 && done >= total;
  // The confetti waits for the server's word: a tap is queued for a moment even online (saved on the
  // phone first), and "Everyone did it" (quiet) only arrives with the page's refresh.
  const saved = useMemo(() => todayProgress(habits), [habits]);
  const allSaved = saved.total > 0 && saved.done >= saved.total;
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    if (!allSaved) return;
    const mark = () => {
      try {
        localStorage.setItem(SEEN_KEY, dayKey);
      } catch {
        // Private mode: celebrate anyway, it just may repeat.
      }
    };
    try {
      if (localStorage.getItem(SEEN_KEY) === dayKey) return;
    } catch {
      // Private mode: as above.
    }
    if (quiet) return mark();
    // In turn with the other bursts (lib/burst-turns.ts): usually at once, after a moment that's showing.
    const turn = takeBurstTurn();
    let played = false;
    const timer = window.setTimeout(() => {
      played = true;
      mark();
      setCelebrate(true);
    }, turn.wait);
    return () => {
      window.clearTimeout(timer);
      if (!played) turn.release();
    };
  }, [allSaved, dayKey, quiet]);

  // "Your 5-day streak is safe" only once the server has every check-in (its streaks include today).
  const streak = allSaved ? todayStreak(habits) : 0;

  return (
    // overflow-x-clip: the confetti never widens the page (no sideways scroll on a phone). The box
    // reaches 8px past the column on each side, so the week link's hover tint isn't clipped.
    <section aria-label={t("today.progressLabel")} className="relative -mx-inner flex flex-col gap-inner overflow-x-clip px-inner">
      {celebrate && <Confetti />}
      {/* Nothing due today (e.g. every habit is paused or has ended): only the week line shows. */}
      {total > 0 && (
        <div className="flex items-center gap-inner">
          <span className="relative flex shrink-0 items-center justify-center">
            <ProgressRing done={done} possible={total} size={44} label={t("today.ringLabel", { done, total })} />
            {!allDone && (
              <span aria-hidden className="absolute text-xs font-bold tabular-nums">
                {Math.round((done / total) * 100)}%
              </span>
            )}
          </span>
          <p role="status" className={cn("min-w-0 flex-1 font-bold tabular-nums", allDone && "text-done")}>
            {todayLine(t, done, total, streak)}
          </p>
        </div>
      )}

      {week && (
        <Link
          href="/progress"
          className="-mx-inner flex min-h-11 items-center gap-inner rounded-xl px-inner text-sm text-muted-foreground hover:bg-muted/60"
        >
          <span className="font-semibold">{t("today.thisWeek")}</span>
          <span aria-hidden>·</span>
          <ProgressRing done={week.done} possible={week.possible} label={t("weekOverview.ringLabel", { goals: goalsMet(t, week.done, week.possible) })} />
          {/* The ring's label says the same for screen readers. */}
          <span aria-hidden className="font-bold text-foreground tabular-nums">
            {t("today.weekCount", { done: week.done, possible: week.possible })}
          </span>
          {week.streak > 0 && (
            <>
              <span aria-hidden>·</span>
              {/* Icon to its number: one element, so 4px (off the scale on purpose, like the chip it was). */}
              <span className="flex items-center gap-1 font-bold text-flame tabular-nums">
                <Flame className="size-4 fill-current" aria-hidden />
                <span className="sr-only">{t("today.bestStreak")}</span>
                {week.streak}
              </span>
            </>
          )}
          <ChevronRight className="ms-auto size-4 rtl:-scale-x-100" aria-hidden />
        </Link>
      )}
    </section>
  );
}
