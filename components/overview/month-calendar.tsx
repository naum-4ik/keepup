"use client";

import { useId, useState } from "react";
import { DayCircle, DayPanel } from "@/components/overview/week-days";
import type { CalendarDay } from "@/lib/calendar";
import type { WeekDay } from "@/lib/week-overview";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function dayLabel(date: string, today: string, d: CalendarDay | undefined): string {
  const [y, m, n] = date.split("-").map(Number);
  const name = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "long" }).format(new Date(Date.UTC(y, m - 1, n)));
  if (date > today) return `${name}: still to come`;
  if (!d || d.possible === 0) return `${name}: nothing due`;
  return `${name}: ${d.done} of ${d.possible} done`;
}

// Progress → Calendar: a month of day circles; tap a day up to today to see what you did.
export function MonthCalendar({ weeks, weekStart, today, days }: { weeks: (string | null)[][]; weekStart: 0 | 1; today: string; days: Record<string, CalendarDay> }) {
  const [selected, setSelected] = useState<string | null>(null);
  const panelId = useId();
  const header = [...WEEKDAYS.slice(weekStart), ...WEEKDAYS.slice(0, weekStart)];
  const asDay = (date: string): WeekDay => ({ local_date: date, daily_done: days[date]?.done ?? 0, daily_possible: days[date]?.possible ?? 0 });
  const sel = selected ? days[selected] : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div aria-hidden className="grid grid-cols-7">
          {header.map((w, i) => (
            <span key={i} className="text-center text-xs font-semibold text-muted-foreground">
              {w}
            </span>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((date, di) => (
              <span key={date ?? `b${wi}-${di}`} className="flex justify-center">
                {date &&
                  (date <= today ? (
                    <button
                      type="button"
                      aria-label={dayLabel(date, today, days[date])}
                      aria-expanded={selected === date}
                      aria-controls={panelId}
                      onClick={() => setSelected((s) => (s === date ? null : date))}
                      className="flex min-h-11 min-w-11 flex-col items-center gap-1 rounded-xl hover:bg-muted/60"
                    >
                      <DayCircle day={asDay(date)} today={today} selected={selected === date} label={String(Number(date.slice(8)))} />
                    </button>
                  ) : (
                    <span role="img" aria-label={dayLabel(date, today, undefined)} className="flex min-h-11 flex-col items-center gap-1">
                      <DayCircle day={asDay(date)} today={today} selected={false} label={String(Number(date.slice(8)))} />
                    </span>
                  ))}
              </span>
            ))}
          </div>
        ))}
      </div>
      {!selected && <p className="text-center text-xs text-muted-foreground">Tap a day to see what you did.</p>}
      <DayPanel id={panelId} date={selected} today={today} day={selected ? asDay(selected) : undefined} rows={selected ? (sel?.rows ?? []) : null} />
    </div>
  );
}
