"use client";

import { useState, useTransition } from "react";
import { undoCheckIn } from "@/app/(app)/habits/actions";
import { Button } from "@/components/ui/button";
import type { HabitPeriod } from "@/lib/habit-schema";
import type { HabitCheckIn } from "@/lib/habits";

export function CheckInList({
  habitId,
  checkIns,
  timeZone,
  period,
}: {
  habitId: string;
  checkIns: HabitCheckIn[];
  timeZone: string;
  period: HabitPeriod;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // A daily habit only ever has today's check-ins in this period, so the weekday plus time is
  // enough; a week/month period spans several days, so show the date too.
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    ...(period !== "day" ? { day: "numeric", month: "short" } : {}),
    hour: "2-digit",
    minute: "2-digit",
  });

  if (checkIns.length === 0) return <p className="text-sm text-muted-foreground">No check-ins this period yet.</p>;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold">
        {checkIns.length} {checkIns.length === 1 ? "check-in" : "check-ins"} this period
      </p>
      <ul className="flex flex-col gap-2">
        {checkIns.map((c) => (
          <li key={c.id} className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-sm">
            <span>{time.format(new Date(c.created_at))}</span>
            <Button
              type="button"
              variant="ghost"
              className="h-11 px-4"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await undoCheckIn(c.id, habitId);
                  setError(r.ok ? null : r.message);
                })
              }
            >
              Undo
            </Button>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
