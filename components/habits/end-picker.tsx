"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { END_PRESETS, endsOnFor, presetLabel } from "@/lib/habit-end";
import type { HabitPeriod } from "@/lib/habit-schema";
import { formatLocalDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Choice = "none" | number | "date";

// ideas/habit-end-date.md: No end (default) · three lengths in the habit's unit · Until a date (not
// "Pick a date": the start picker already has a button with that name). Posts
// `endsOn` (the last day that counts) or "" for no end.
export function EndPicker({ period, startsOn, name = "endsOn" }: { period: HabitPeriod; startsOn: string; name?: string }) {
  const [choice, setChoice] = useState<Choice>("none");
  const [date, setDate] = useState("");
  const endsOn = choice === "none" ? "" : choice === "date" ? date : endsOnFor(startsOn, period, choice);
  const chip =
    "flex h-11 items-center rounded-full border border-border bg-card px-3.5 text-sm font-semibold hover:bg-muted aria-pressed:border-primary aria-pressed:bg-accent";

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-semibold">Ends</legend>
      <input type="hidden" name={name} value={endsOn} />
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={choice === "none"} onClick={() => setChoice("none")} className={chip}>
          No end
        </button>
        {END_PRESETS[period].map((n) => (
          <button key={n} type="button" aria-pressed={choice === n} onClick={() => setChoice(n)} className={chip}>
            {presetLabel(n, period)}
          </button>
        ))}
        <button type="button" aria-pressed={choice === "date"} onClick={() => setChoice("date")} className={chip}>
          Until a date
        </button>
      </div>
      {choice === "date" && (
        <Input
          type="date"
          aria-label="End date"
          min={startsOn}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-11 w-48 rounded-xl px-3 text-base"
        />
      )}
      <p className={cn("text-xs text-muted-foreground")}>
        {endsOn ? `Last day: ${formatLocalDate(endsOn)}. Then you choose to keep going or finish.` : "Keeps going until you stop it."}
      </p>
    </fieldset>
  );
}
