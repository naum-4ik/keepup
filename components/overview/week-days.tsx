"use client";

import { Check, Clock, Pause } from "lucide-react";
import { useId, useState } from "react";
import { HabitEmoji } from "@/components/habits/category-icon";
import type { DayRow } from "@/lib/day-detail";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { ringFraction, type WeekDay } from "@/lib/week-overview";
import { INTL_LOCALE, type Locale, type T } from "@/supabase/functions/_shared/i18n";

const weekdayName = (localDate: string, style: "long" | "narrow", locale: Locale) => {
  const [y, m, d] = localDate.split("-").map(Number);
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "UTC", weekday: style }).format(new Date(Date.UTC(y, m - 1, d)));
};

const longDate = (localDate: string, locale: Locale) => {
  const [y, m, d] = localDate.split("-").map(Number);
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "UTC", weekday: "long", day: "numeric", month: "short" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
};

function dayLabel(t: T, locale: Locale, day: WeekDay, today: string): string {
  const name = weekdayName(day.local_date, "long", locale);
  if (day.local_date > today) return t("overview.day.future", { name });
  if (day.daily_possible === 0) return t("overview.day.nothingDue", { name });
  return t("overview.day.counts", { name, done: String(day.daily_done), possible: String(day.daily_possible) });
}

// A circle that fills from the bottom with the share of the day's daily habits done.
// The label under it: the weekday letter on the week strip, the day number on the calendar.
export function DayCircle({ day, today, selected, label }: { day: WeekDay; today: string; selected: boolean; label?: string }) {
  const { locale } = useT();
  const size = 32;
  const r = 13;
  const isToday = day.local_date === today;
  // Future days and days with nothing due (e.g. before the first habit) are a small dot, not an empty
  // circle: an empty circle reads as a missed day.
  const future = day.local_date > today || (day.daily_possible === 0 && !isToday);
  const fill = ringFraction(day.daily_done, day.daily_possible);
  const clipId = `day-fill-${day.local_date}`;
  return (
    <>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        {future ? (
          <>
            <circle cx={16} cy={16} r={3} className="fill-muted-foreground/25" />
            {selected && <circle cx={16} cy={16} r={r + 1.5} fill="none" strokeWidth={2.5} className="stroke-primary" />}
          </>
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
        {label ?? weekdayName(day.local_date, "narrow", locale)}
      </span>
    </>
  );
}

const STATUS: Record<DayRow["status"], string> = {
  done: "text-done",
  checked_in: "text-done",
  open: "text-muted-foreground",
  missed: "text-muted-foreground",
  paused: "text-frozen",
  rested: "text-done",
};

function RowStatus({ row }: { row: DayRow }) {
  const { t } = useT();
  const done = row.status === "done" || row.status === "checked_in";
  return (
    <span className={cn("flex shrink-0 items-center gap-1 text-sm font-semibold", STATUS[row.status])}>
      {done && <Check aria-hidden className="size-4" strokeWidth={3} />}
      {row.status === "paused" && <Pause aria-hidden className="size-4" />}
      {t(`overview.status.${row.status}`)}
      {done && row.count > 1 && <span className="tabular-nums">× {row.count}</span>}
    </span>
  );
}

// Progress: the week's days; tapping a past day (or today) shows what you did that day.
export function WeekDays({ days, today, details }: { days: WeekDay[]; today: string; details?: Record<string, DayRow[]> }) {
  const { t, locale } = useT();
  const [selected, setSelected] = useState<string | null>(null);
  const panelId = useId();
  const rows = selected && details ? (details[selected] ?? []) : null;
  const day = days.find((d) => d.local_date === selected);

  return (
    <div className="flex flex-col gap-inner">
      <ol aria-label={t("overview.byDayLabel")} className="flex justify-between">
        {days.map((d) => {
          const tappable = Boolean(details) && d.local_date <= today;
          return (
            <li key={d.local_date} className="flex flex-1 justify-center">
              {tappable ? (
                <button
                  type="button"
                  aria-label={dayLabel(t, locale, d, today)}
                  aria-expanded={selected === d.local_date}
                  aria-controls={panelId}
                  onClick={() => setSelected((s) => (s === d.local_date ? null : d.local_date))}
                  className="flex min-h-11 min-w-11 flex-col items-center rounded-xl hover:bg-muted/60"
                >
                  <DayCircle day={d} today={today} selected={selected === d.local_date} />
                </button>
              ) : (
                <span role="img" aria-label={dayLabel(t, locale, d, today)} className="flex min-h-11 flex-col items-center">
                  <DayCircle day={d} today={today} selected={false} />
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {details && !selected && <p className="text-center text-xs text-muted-foreground">{t("overview.tapDay")}</p>}

      <DayPanel id={panelId} date={selected} today={today} day={day} rows={rows} />
    </div>
  );
}

// What you did on one day: shared by the week strip and the calendar.
export function DayPanel({ id, date, today, day, rows }: { id: string; date: string | null; today: string; day?: WeekDay; rows: DayRow[] | null }) {
  const { t, locale } = useT();
  return (
    <div id={id} hidden={!rows} role="region" aria-label={date ? longDate(date, locale) : undefined}>
      {rows && date && (
        // A soft tint, not a card: 12 px sides to match its 12 px radius (as Notice does).
        <div className="flex flex-col gap-inner rounded-xl bg-muted/50 px-3 py-inner">
          <p className="flex items-baseline justify-between gap-inner">
            <span className="font-bold">{date === today ? t("dates.today") : longDate(date, locale)}</span>
            {day && day.daily_possible > 0 && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {t("overview.dailyDone", { done: String(day.daily_done), possible: String(day.daily_possible) })}
              </span>
            )}
          </p>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("overview.noCheckIns")}</p>
          ) : (
            <ul className="flex flex-col">
              {rows.map((r) => (
                <li key={r.habitId} className="flex min-h-11 items-center gap-inner">
                  <HabitEmoji category={r.category} emoji={r.emoji} size="xs" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.title}</span>
                  {r.pending > 0 && (
                    // 4 px icon to count, off the scale on purpose (one glyph pair).
                    <span className="flex items-center gap-1 text-xs font-semibold text-pending">
                      <Clock aria-hidden className="size-3.5" />
                      {t("overview.waiting", { n: r.pending })}
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
  );
}
