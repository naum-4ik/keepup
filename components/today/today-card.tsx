"use client";

import Link from "next/link";
import { Check, ChevronRight, Flame } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Confetti } from "@/components/celebrations/confetti";
import { HabitEmoji } from "@/components/habits/category-icon";
import { useOfflineQueue } from "@/components/offline/offline-queue-provider";
import { ProgressRing } from "@/components/overview/week-overview";
import { todayLine, todayProgress, withQueuedProgress, type ProgressHabit } from "@/lib/today-progress";
import { cn } from "@/lib/utils";

const SEEN_KEY = "keepup:all-done-celebrated";

// The top of Today (ideas/today-card.md): today's ring, a line that moves with you, the day's habits
// as emoji that light up when done, and this week in one line. The last check-in of the day gets a
// small confetti burst, once per day on this device (the day counts as celebrated even when quiet).
// Taps still waiting on this phone (offline) count too, as the check-ins they will be.
export function TodayCard({
  date,
  dayKey,
  habits,
  week,
  quiet = false,
}: {
  date: string;
  dayKey: string;
  // Today's adult habits, as the page lists them (lib/today-progress.ts todayProgress).
  habits: ProgressHabit[];
  week: { done: number; possible: number; streak: number } | null;
  // Another celebration (e.g. "Everyone did it") is already on screen: don't burst twice.
  quiet?: boolean;
}) {
  const { delta } = useOfflineQueue();
  const { done, total, items } = useMemo(() => todayProgress(withQueuedProgress(habits, delta)), [habits, delta]);
  const allDone = total > 0 && done >= total;
  // The confetti waits for the server's word: a tap is queued for a moment even online (saved on the
  // phone first), and "Everyone did it" (quiet) only arrives with the page's refresh.
  const saved = useMemo(() => todayProgress(habits), [habits]);
  const allSaved = saved.total > 0 && saved.done >= saved.total;
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    if (!allSaved) return;
    try {
      if (localStorage.getItem(SEEN_KEY) === dayKey) return;
      localStorage.setItem(SEEN_KEY, dayKey);
    } catch {
      // Private mode: celebrate anyway, it just may repeat.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- plays once, after the day's last check-in
    if (!quiet) setCelebrate(true);
  }, [allSaved, dayKey, quiet]);

  return (
    <section
      aria-label="Today's progress"
      className={cn(
        "relative flex flex-col gap-3 overflow-hidden rounded-2xl p-4 shadow-soft transition-colors",
        allDone ? "bg-done-soft" : "bg-card",
      )}
    >
      {celebrate && <Confetti />}
      {/* Nothing due today (e.g. every habit is paused or has ended): only the week line shows. */}
      {total > 0 && (
      <div className="flex items-center gap-4">
          <span className="relative flex shrink-0 items-center justify-center">
            <ProgressRing done={done} possible={total} size={64} label={`${done} of ${total} done today`} />
            {!allDone && total > 0 && (
              <span aria-hidden className="absolute text-sm font-bold tabular-nums">
                {Math.round((done / total) * 100)}%
              </span>
            )}
          </span>
          <div className="flex min-w-0 flex-col">
            <p className="text-sm font-semibold text-muted-foreground">{date}</p>
            <p className="text-lg font-bold tabular-nums">
              {done} of {total} done
            </p>
            <p role="status" className={cn("text-sm font-semibold", allDone ? "text-done" : "text-primary")}>
              {todayLine(done, total)}
            </p>
          </div>
        </div>
      )}

      {items.length > 0 && (
        // One picture with one label: the habit cards below are the interactive part.
        <div
          role="img"
          aria-label={`Today's habits: ${items.map((i) => `${i.title} ${i.done ? "done" : "to do"}`).join(", ")}`}
          className="flex flex-wrap gap-1.5"
        >
          {items.map((i) => (
            <span key={i.habitId} data-done={i.done || undefined} className="relative">
              <HabitEmoji category={i.category} emoji={i.emoji} className={cn("size-9 transition", !i.done && "opacity-40 grayscale dark:opacity-60 dark:brightness-150")} />
              {i.done && (
                <span aria-hidden className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-done text-done-foreground ring-2 ring-card">
                  <Check className="size-2.5" strokeWidth={4} />
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {week && (
        <Link
          href="/progress"
          className="-mx-2 -mb-2 flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm text-muted-foreground hover:bg-muted/60"
        >
          <span className="font-semibold">This week</span>
          <span aria-hidden>·</span>
          <ProgressRing done={week.done} possible={week.possible} />
          {/* The ring's label says the same for screen readers. */}
          <span aria-hidden className="font-bold text-foreground tabular-nums">
            {week.done} of {week.possible}
          </span>
          {week.streak > 0 && (
            <>
              <span aria-hidden>·</span>
              <span className="flex items-center gap-1 font-bold text-flame tabular-nums">
                <Flame className="size-4 fill-current" aria-hidden />
                <span className="sr-only">Best streak:</span>
                {week.streak}
              </span>
            </>
          )}
          <ChevronRight className="ml-auto size-4" aria-hidden />
        </Link>
      )}
    </section>
  );
}
