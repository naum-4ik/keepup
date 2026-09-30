"use client";

import { Check, Clock, Pause } from "lucide-react";
import { useId, useState } from "react";
import { HabitEmoji } from "@/components/habits/category-icon";
import type { DayRow } from "@/lib/day-detail";
import { cn } from "@/lib/utils";
import { ringFraction, type WeekDay } from "@/lib/week-overview";

const weekdayName = (localDate: string, style: "long" | "narrow") => {
  const [y, m, d] = localDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: style }).format(new Date(Date.UTC(y, m - 1, d)));
};

const longDate = (localDate: string) => {
  const [y, m, d] = localDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "short" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
};

function dayLabel(day: WeekDay, today: string): string {
  const name = weekdayName(day.local_date, "long");
  if (day.local_date > today) return `${name}: still to come`;
  if (day.daily_possible === 0) return `${name}: nothing due`;
  return `${name}: ${day.daily_done} of ${day.daily_possible} done`;
}

// A circle that fills from the bottom with the share of the day's daily habits done.
function DayCircle({ day, today, selected }: { day: WeekDay; today: string; selected: boolean }) {
  const size = 32;
  const r = 13;
  const future = day.local_date > today;
  const isToday = day.local_date === today;
  const fill = ringFraction(day.daily_done, day.daily_possible);
  const clipId = `day-fill-${day.local_date}`;
  return (
    <>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        {future ? (
          <circle cx={16} cy={16} r={3} className="fill-muted-foreground/25" />
        ) : (
          <>
            <defs>
              <clipPath id={clipId}>
                <rect x={0} y={size - size * fill} width={size} height={size * fill} />
              </clipPath>
            </defs>
            <circle cx={16} cy={16} r={r} className="fill-muted" />
            {fill > 0 && <circle cx={16} cy={16} r={r} clipPath={`url(#${clipId})`} className="fill-primary" />}
            {(isToday || selected) && (
              <circle cx={16} cy={16} r={r + 1.5} fill="none" strokeWidth={selected ? 2.5 : 1.5} className={selected ? "stroke-primary" : "stroke-foreground"} />
            )}
          </>
        )}
      </svg>
      <span className={cn("text-xs", isToday || selected ? "font-bold text-foreground" : "text-muted-foreground")}>
        {weekdayName(day.local_date, "narrow")}
      </span>
    </>
  );
}

const STATUS: Record<DayRow["status"], { text: string; className: string }> = {
  done: { text: "Done", className: "text-[#4F8A5B]" },
  checked_in: { text: "Checked in", className: "text-[#4F8A5B]" },
  open: { text: "Not done yet", className: "text-muted-foreground" },
  missed: { text: "Not done", className: "text-muted-foreground" },
  paused: { text: "Paused", className: "text-[#3B82B8]" },
};

function RowStatus({ row }: { row: DayRow }) {
  const s = STATUS[row.status];
  const done = row.status === "done" || row.status === "checked_in";
  return (
    <span className={cn("flex shrink-0 items-center gap-1 text-sm font-semibold", s.className)}>
      {done && <Check aria-hidden className="size-4" strokeWidth={3} />}
      {row.status === "paused" && <Pause aria-hidden className="size-4" />}
      {s.text}
      {done && row.count > 1 && <span className="tabular-nums">× {row.count}</span>}
    </span>
  );
}

// Progress: the week's days; tapping a past day (or today) shows what you did that day.
export function WeekDays({ days, today, details }: { days: WeekDay[]; today: string; details?: Record<string, DayRow[]> }) {
  const [selected, setSelected] = useState<string | null>(null);
  const panelId = useId();
  const rows = selected && details ? (details[selected] ?? []) : null;
  const day = days.find((d) => d.local_date === selected);

  return (
    <div className="flex flex-col gap-3">
      <ol aria-label="This week by day" className="flex justify-between">
        {days.map((d) => {
          const tappable = Boolean(details) && d.local_date <= today;
          return (
            <li key={d.local_date} className="flex flex-1 justify-center">
              {tappable ? (
                <button
                  type="button"
                  aria-label={dayLabel(d, today)}
                  aria-expanded={selected === d.local_date}
                  aria-controls={panelId}
                  onClick={() => setSelected((s) => (s === d.local_date ? null : d.local_date))}
                  className="flex min-h-11 min-w-11 flex-col items-center gap-1 rounded-xl hover:bg-muted/60"
                >
                  <DayCircle day={d} today={today} selected={selected === d.local_date} />
                </button>
              ) : (
                <span role="img" aria-label={dayLabel(d, today)} className="flex min-h-11 flex-col items-center gap-1">
                  <DayCircle day={d} today={today} selected={false} />
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {details && !selected && <p className="text-center text-xs text-muted-foreground">Tap a day to see what you did.</p>}

      <div id={panelId} hidden={!rows} role="region" aria-label={selected ? longDate(selected) : undefined}>
        {rows && selected && (
          <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3">
            <p className="flex items-baseline justify-between gap-2">
              <span className="font-bold">{selected === today ? "Today" : longDate(selected)}</span>
              {day && day.daily_possible > 0 && (
                <span className="text-sm text-muted-foreground tabular-nums">
                  {day.daily_done} of {day.daily_possible} daily done
                </span>
              )}
            </p>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No check-ins this day.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {rows.map((r) => (
                  <li key={r.habitId} className="flex min-h-10 items-center gap-2.5">
                    <HabitEmoji category={r.category} emoji={r.emoji} size="xs" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.title}</span>
                    {r.pending > 0 && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-[#9A6A10]">
                        <Clock aria-hidden className="size-3.5" />
                        {r.pending} waiting
                      </span>
                    )}
                    <RowStatus row={r} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
