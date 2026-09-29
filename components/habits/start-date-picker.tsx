"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, addMonths, formatLocalDate, formatMonth, monthGrid, nextWeekStart } from "@/lib/dates";
import { cn } from "@/lib/utils";

const shortDate = (date: string) => formatLocalDate(date).split(" ").slice(1).join(" ");
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const chipClass =
  "flex h-11 items-center justify-center gap-1 rounded-full border border-input px-1.5 text-[0.8125rem] font-semibold whitespace-nowrap text-muted-foreground aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:text-foreground";

type QuickPick = { label: string; date: string };

type Props = {
  value: string;
  onChange: (date: string) => void;
  today: string;
  // Earliest selectable date; defaults to `today`. Lets a caller (e.g. a pause's "Until") pick
  // from some later floor (its "Pause from" date) while `today` still marks the real today.
  min?: string;
  weekStart: 0 | 1;
  errorId?: string;
  // Overrides the default Today/Tomorrow/Next-weekday picks, for a date that isn't relative to
  // today (e.g. a pause's end date, relative to when the pause starts).
  quickPicks?: QuickPick[];
};

// Quick picks cover the common case (start now); the month grid handles anything else.
// Styled with the app's tokens instead of the browser's native date popup.
export function StartDatePicker({ value, onChange, today, min = today, weekStart, errorId, quickPicks }: Props) {
  const quick =
    quickPicks ?? [
      { label: "Today", date: today },
      { label: "Tomorrow", date: addDays(today, 1) },
      { label: `Next ${WEEKDAYS[weekStart]}`, date: nextWeekStart(today, weekStart) },
    ];
  const isQuick = quick.some((q) => q.date === value);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(value.slice(0, 7));
  const weekdays = [...WEEKDAYS.slice(weekStart), ...WEEKDAYS.slice(0, weekStart)];

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-1.5">
        {quick.map((q) => (
          <button key={q.label} type="button" aria-pressed={value === q.date} className={chipClass}
            onClick={() => { onChange(q.date); setOpen(false); }}>
            {q.label}
          </button>
        ))}
        <button type="button" aria-pressed={!isQuick} aria-expanded={open} aria-label={isQuick ? "Pick a date" : `Pick a date, ${formatLocalDate(value)}`} className={chipClass}
          onClick={() => { setMonth(value.slice(0, 7)); setOpen((o) => !o); }}>
          <CalendarDays aria-hidden className="size-4" />
          {isQuick ? "Date" : shortDate(value)}
        </button>
      </div>

      {open && (
        <div className="rounded-2xl border border-input p-3" aria-describedby={errorId}>
          <div className="mb-1 flex items-center justify-between">
            <button type="button" aria-label="Previous month" disabled={month <= min.slice(0, 7)}
              onClick={() => setMonth((m) => addMonths(m, -1))}
              className="flex size-11 items-center justify-center rounded-full text-primary hover:bg-muted disabled:text-muted-foreground/40">
              <ChevronLeft className="size-5" />
            </button>
            <span className="text-sm font-bold" aria-live="polite">{formatMonth(month)}</span>
            <button type="button" aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}
              className="flex size-11 items-center justify-center rounded-full text-primary hover:bg-muted">
              <ChevronRight className="size-5" />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center">
            {weekdays.map((d) => (
              <span key={d} className="pb-1 text-xs font-semibold text-muted-foreground">{d.slice(0, 2)}</span>
            ))}
            {monthGrid(month, weekStart).map((date, i) =>
              date === null ? (
                <span key={`pad-${i}`} />
              ) : (
                <button
                  key={date}
                  type="button"
                  disabled={date < min}
                  aria-pressed={date === value}
                  aria-label={formatLocalDate(date)}
                  onClick={() => { onChange(date); setOpen(false); }}
                  className={cn(
                    "flex h-11 w-full items-center justify-center rounded-full text-sm tabular-nums",
                    "hover:bg-muted disabled:text-muted-foreground/40 disabled:hover:bg-transparent",
                    date === today && "font-bold text-primary",
                    date === value && "bg-primary font-bold text-primary-foreground hover:bg-primary",
                  )}
                >
                  {Number(date.slice(8))}
                </button>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
