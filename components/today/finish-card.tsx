"use client";

import { useState, useTransition } from "react";
import { finishHabit, keepGoing } from "@/app/(app)/habits/actions";
import { Confetti } from "@/components/celebrations/confetti";
import { HabitEmoji } from "@/components/habits/category-icon";
import { Button } from "@/components/ui/button";
import type { HabitCategory } from "@/lib/habit-schema";

// ideas/habit-end-date.md: a habit reached its end. Celebrate what was done (at least half), then Keep going (the end
// is removed) or Finish (to the Finished list). Only the owner, or an admin for a group habit, decides.
export function FinishCard({
  habitId,
  title,
  emoji,
  category,
  line,
  celebrate,
  canDecide,
}: {
  habitId: string;
  title: string;
  emoji: string | null;
  category: HabitCategory | null;
  line: string;
  celebrate: boolean;
  canDecide: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: (id: string) => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      const r = await fn(habitId);
      if (!r.ok) setError(r.message ?? null);
    });

  return (
    <section
      aria-label={`${title} is finished`}
      className="relative flex flex-col gap-3 overflow-hidden rounded-2xl bg-[#E5F2E6] p-4 shadow-soft dark:bg-[#4F8A5B]/20"
    >
      {celebrate && <Confetti />}
      {/* Above the confetti, so the pieces pass behind the text. */}
      <div className="relative z-10 flex items-center gap-3">
        <HabitEmoji category={category} emoji={emoji} />
        <div className="flex min-w-0 flex-col">
          <p className="truncate font-bold">{title} reached its end{celebrate && " 🎉"}</p>
          <p className="text-sm text-[#2F5E3A] dark:text-foreground">{line}</p>
        </div>
      </div>
      {canDecide ? (
        <div className="relative z-10 flex gap-2">
          <Button type="button" variant="outline" className="h-11 flex-1 bg-card" disabled={pending} onClick={() => run(finishHabit)}>
            Finish
          </Button>
          <Button type="button" className="h-11 flex-1" disabled={pending} onClick={() => run(keepGoing)}>
            Keep going
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">An admin of the group chooses what&apos;s next.</p>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
