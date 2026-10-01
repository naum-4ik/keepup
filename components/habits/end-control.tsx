"use client";

import { useState, useTransition } from "react";
import { changeHabitEnd, finishHabit, keepGoing, type ActionResult } from "@/app/(app)/habits/actions";
import { endOptions } from "@/lib/habit-end";
import type { HabitPeriod } from "@/lib/habit-schema";
import { formatLocalDate } from "@/lib/dates";

// The habit page's end (ideas/habit-end-date.md): extend it or remove it; never earlier. Once the
// habit's own today is past the end, only the finish card's two choices are left.
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
  const run = (call: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const r = await call();
      setError(r.ok ? null : r.message);
    });
  const options = endOptions(startsOn, endsOn, today, period);
  const chip =
    "flex h-11 items-center rounded-full border border-border bg-card px-3.5 text-sm font-semibold hover:bg-muted disabled:opacity-50";

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        {endsOn ? `Last day: ${formatLocalDate(endsOn)}.` : "No end: it keeps going until you stop it."}
        {!options && " It reached its end. Keep going removes the end; Finish moves it to Finished."}
      </p>
      <div className="flex flex-wrap gap-2">
        {options ? (
          <>
            {options.map((o) => (
              <button key={o.n} type="button" disabled={pending} onClick={() => run(() => changeHabitEnd(habitId, o.date))} className={chip}>
                {o.label}
              </button>
            ))}
            {endsOn && (
              <button type="button" disabled={pending} onClick={() => run(() => changeHabitEnd(habitId, null))} className={chip}>
                Remove end
              </button>
            )}
          </>
        ) : (
          <>
            <button type="button" disabled={pending} onClick={() => run(() => finishHabit(habitId))} className={chip}>
              Finish
            </button>
            <button type="button" disabled={pending} onClick={() => run(() => keepGoing(habitId))} className={chip}>
              Keep going
            </button>
          </>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
