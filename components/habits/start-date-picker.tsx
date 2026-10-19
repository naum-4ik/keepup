"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, addMonths, formatLocalDate, formatMonth, monthGrid, nextWeekStart } from "@/lib/dates";
import { INTL_LOCALE, type Locale } from "@/supabase/functions/_shared/i18n";
import { useT } from "@/lib/i18n/client";
import { fromWeekStart, weekdayLabels } from "@/lib/weekdays";
import { cn } from "@/lib/utils";

const shortDate = (date: string, locale: Locale) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(Date.UTC(y, m - 1, d)));
};
// The one chip for date choices: Starts here, Ends in EndPicker (same height, type and pressed state).
// 4px icon-to-label (off the scale): the calendar icon belongs to the word on a narrow chip.
export const dateChipClass =
  "flex h-11 min-w-0 items-center justify-center gap-1 rounded-full border border-input px-inner text-[0.8125rem] font-semibold whitespace-nowrap text-muted-foreground hover:border-primary/60 hover:bg-accent/60 hover:text-foreground aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:text-foreground";

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
  const { t, locale } = useT();
  const headers = useMemo(() => weekdayLabels(locale, "two"), [locale]);
  const quick =
    quickPicks ?? [
      { label: t("dates.today"), date: today },
      { label: t("habits.datePicker.tomorrow"), date: addDays(today, 1) },
      { label: t("habits.datePicker.next", { day: weekStart }), date: nextWeekStart(today, weekStart) },
    ];
  const isQuick = quick.some((q) => q.date === value);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(value.slice(0, 7));
  const weekdays = fromWeekStart(headers, weekStart);

  return (
    <div className="@container flex flex-col gap-inner">
      {/* data-invalid: a refused date takes focus on its first chip (lib/focus-first-invalid.ts). */}
      {/* Two chips a row where four don't fit their words ("Tomorrow", "Next Mon" at 320: the sheet is
          248px wide), four from 320px of room. */}
      <div className="grid grid-cols-2 gap-inner @min-[20rem]:grid-cols-4" data-invalid={errorId ? "" : undefined} aria-describedby={errorId}>
        {quick.map((q) => (
          <button key={q.label} type="button" aria-pressed={value === q.date} className={dateChipClass}
            onClick={() => { onChange(q.date); setOpen(false); }}>
            {q.label}
          </button>
        ))}
        <button type="button" aria-pressed={!isQuick} aria-expanded={open} aria-label={isQuick ? t("habits.datePicker.pick") : t("habits.datePicker.pickWith", { date: formatLocalDate(value, locale) })} className={dateChipClass}
          onClick={() => { setMonth(value.slice(0, 7)); setOpen((o) => !o); }}>
          <CalendarDays aria-hidden className="size-4" />
          {isQuick ? t("habits.datePicker.date") : shortDate(value, locale)}
        </button>
      </div>

      {open && (
        <div className="rounded-2xl border border-input p-inner" aria-describedby={errorId}>
          <div className="mb-inner flex items-center justify-between">
            <button type="button" aria-label={t("habits.datePicker.previousMonth")} disabled={month <= min.slice(0, 7)}
              onClick={() => setMonth((m) => addMonths(m, -1))}
              className="flex size-11 items-center justify-center rounded-full text-primary hover:bg-muted disabled:text-muted-foreground/40">
              <ChevronLeft className="size-5 rtl:-scale-x-100" />
            </button>
            <span className="text-sm font-bold" aria-live="polite">{formatMonth(month, locale)}</span>
            <button type="button" aria-label={t("habits.datePicker.nextMonth")} onClick={() => setMonth((m) => addMonths(m, 1))}
              className="flex size-11 items-center justify-center rounded-full text-primary hover:bg-muted">
              <ChevronRight className="size-5 rtl:-scale-x-100" />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center">
            {weekdays.map((d, i) => (
              <span key={i} className="pb-inner text-xs font-semibold text-muted-foreground">{d}</span>
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
                  aria-label={formatLocalDate(date, locale)}
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
