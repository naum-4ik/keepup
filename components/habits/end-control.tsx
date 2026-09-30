"use client";

import { useState, useTransition } from "react";
import { changeHabitEnd } from "@/app/(app)/habits/actions";
import { END_PRESETS, endsOnFor, extendEnd, presetLabel } from "@/lib/habit-end";
import type { HabitPeriod } from "@/lib/habit-schema";
import { formatLocalDate } from "@/lib/dates";

// The habit page's end (ideas/habit-end-date.md): extend it or remove it; never earlier.
export function EndControl({
  habitId,
  period,
  startsOn,
  endsOn,
  today,
}: {
  habitId: string;
  period: HabitPeriod;
  startsOn: string;
  endsOn: string | null;
  today: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (next: string | null) =>
    startTransition(async () => {
      const r = await changeHabitEnd(habitId, next);
      setError(r.ok ? null : r.message);
    });
  // With an end: "+30 days" after it. Without: from the start, only lengths that end today or later.
  const options = END_PRESETS[period]
    .map((n) => ({ n, date: endsOn ? extendEnd(endsOn, period, n) : endsOnFor(startsOn, period, n) }))
    .filter((o) => o.date >= today);
  const chip =
    "flex h-11 items-center rounded-full border border-border bg-card px-3.5 text-sm font-semibold hover:bg-muted disabled:opacity-50";

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">{endsOn ? `Last day: ${formatLocalDate(endsOn)}.` : "No end: it keeps going until you stop it."}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.n} type="button" disabled={pending} onClick={() => run(o.date)} className={chip}>
            {endsOn ? `+${presetLabel(o.n, period)}` : presetLabel(o.n, period)}
          </button>
        ))}
        {endsOn && (
          <button type="button" disabled={pending} onClick={() => run(null)} className={chip}>
            Remove end
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
