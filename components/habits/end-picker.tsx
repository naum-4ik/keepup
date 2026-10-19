"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { dateChipClass } from "@/components/habits/start-date-picker";
import { END_PRESETS, endsOnFor, presetLabel } from "@/lib/habit-end";
import type { HabitPeriod } from "@/lib/habit-schema";
import { formatLocalDate } from "@/lib/dates";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

type Choice = "none" | number | "date";

// ideas/habit-end-date.md: No end (default) · the lengths in the habit's unit · Until a date (not
// "Pick a date": the start picker already has a button with that name). Posts
// `endsOn` (the last day that counts) or "" for no end.
export function EndPicker({ period, startsOn, name = "endsOn" }: { period: HabitPeriod; startsOn: string; name?: string }) {
  const { t, locale } = useT();
  const [choice, setChoice] = useState<Choice>("none");
  const [date, setDate] = useState("");
  const endsOn = choice === "none" ? "" : choice === "date" ? date : endsOnFor(startsOn, period, choice);
  return (
    <fieldset className="flex flex-col gap-inner">
      <legend className="mb-inner text-sm font-semibold">{t("habits.endPicker.legend")}</legend>
      <input type="hidden" name={name} value={endsOn} />
      <div className="grid grid-cols-3 gap-inner">
        <button type="button" aria-pressed={choice === "none"} onClick={() => setChoice("none")} className={dateChipClass}>
          {t("habits.endPicker.noEnd")}
        </button>
        {END_PRESETS[period].map((n) => (
          <button key={n} type="button" aria-pressed={choice === n} onClick={() => setChoice(n)} className={dateChipClass}>
            {presetLabel(t, n, period)}
          </button>
        ))}
        <button type="button" aria-pressed={choice === "date"} onClick={() => setChoice("date")} className={dateChipClass}>
          {t("habits.endPicker.untilDate")}
        </button>
      </div>
      {choice === "date" && (
        <Input
          type="date"
          aria-label={t("habits.endPicker.dateLabel")}
          min={startsOn}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-11 w-48 rounded-xl px-3 text-base" // 12px inset: matches the radius
        />
      )}
      <p className={cn("text-xs text-muted-foreground")}>
        {endsOn ? t("habits.endPicker.lastDay", { date: formatLocalDate(endsOn, locale) }) : t("habits.endPicker.keepsGoing")}
      </p>
    </fieldset>
  );
}
