"use client";

import { useEffect, useState, useTransition } from "react";
import { finishHabit, keepGoing } from "@/app/(app)/habits/actions";
import { Confetti } from "@/components/celebrations/confetti";
import { HabitEmoji } from "@/components/habits/category-icon";
import { Button } from "@/components/ui/button";
import { CONFETTI_TURN_MS, takeConfettiTurn } from "@/lib/habit-finish";
import type { HabitCategory } from "@/lib/habit-schema";

const seenKey = (habitId: string, endsOn: string) => `keepup:finish-celebrated:${habitId}:${endsOn}`;
// Shared by the finish cards on screen, so their bursts play one after another.
const turns = { freeAt: 0 };

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
// cards each play theirs, in turn.
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
  const [confetti, setConfetti] = useState(false);
  useEffect(() => {
    const key = seenKey(habitId, endsOn);
    if (!celebrate || quiet || seen(key)) return;
    const now = Date.now();
    const wait = takeConfettiTurn(turns, now);
    let played = false;
    const timer = window.setTimeout(() => {
      played = true;
      markSeen(key);
      setConfetti(true);
    }, wait);
    return () => {
      window.clearTimeout(timer);
      // Gone before its turn: hand the turn back if nobody queued behind it.
      if (!played && turns.freeAt === now + wait + CONFETTI_TURN_MS) turns.freeAt = now + wait;
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
    <section
      aria-label={`${title} is finished`}
      className="relative flex flex-col gap-3 overflow-hidden rounded-2xl bg-done-soft p-4 shadow-soft"
    >
      {confetti && <Confetti />}
      {/* Above the confetti, so the pieces pass behind the text. */}
      <div className="relative z-10 flex items-center gap-3">
        <HabitEmoji category={category} emoji={emoji} />
        <div className="flex min-w-0 flex-col">
          <p className="truncate font-bold">{title} reached its end{celebrate && " 🎉"}</p>
          <p className="text-sm text-done dark:text-foreground">{line}</p>
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
