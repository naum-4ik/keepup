"use client";

import { Minus, Plus } from "lucide-react";
import { TARGET_LIMITS, type HabitPeriod } from "@/lib/habit-schema";

// The −/＋ count (posts `targetCount`), shared by the new-habit form and a child's own habit.
// Typing stays free, so a count past the limit reaches the server, gets its message and is kept;
// the buttons step within 1 and the period's limit. The label is the caller's (<Label htmlFor={id}>).
export function CountStepper({
  id,
  value,
  onChange,
  period,
  invalid = false,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  period: HabitPeriod;
  invalid?: boolean;
  describedBy?: string;
}) {
  const count = Number(value);
  const limit = TARGET_LIMITS[period];
  const step = (delta: number) => onChange(String(Math.min(limit, Math.max(1, (count || 0) + delta))));

  return (
    <div className="flex h-11 items-center rounded-xl border border-input">
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={count <= 1}
        aria-label="Decrease"
        className="flex size-11 shrink-0 items-center justify-center rounded-l-xl text-primary enabled:hover:bg-accent disabled:text-muted-foreground/50"
      >
        <Minus aria-hidden className="size-4" />
      </button>
      <input
        id={id}
        name="targetCount"
        type="number"
        inputMode="numeric"
        min={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full w-full min-w-0 bg-transparent text-center text-base font-bold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        aria-invalid={invalid}
        aria-describedby={describedBy}
      />
      <button
        type="button"
        onClick={() => step(1)}
        disabled={count >= limit}
        aria-label="Increase"
        className="flex size-11 shrink-0 items-center justify-center rounded-r-xl text-primary enabled:hover:bg-accent disabled:text-muted-foreground/50"
      >
        <Plus aria-hidden className="size-4" />
      </button>
    </div>
  );
}
