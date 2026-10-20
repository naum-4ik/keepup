import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { LinkPending } from "@/components/ui/link-pending";
import { MonthCalendar } from "@/components/overview/month-calendar";
import { getProfile } from "@/lib/auth";
import { formatMonth } from "@/lib/dates";
import { getT } from "@/lib/i18n/server";
import { monthGrid, parseMonth, shiftMonth, summarizeDays } from "@/lib/calendar";
import { getCalendarCells, getFirstHabitStart, getHabitSummaries } from "@/lib/habits";

const NAV = "relative flex size-11 items-center justify-center rounded-full text-sm font-semibold";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const [{ profile }, { t, locale }] = await Promise.all([getProfile(), getT()]);
  const monthName = (month: string) => formatMonth(month, locale);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: profile.timezone }).format(new Date());
  const month = parseMonth(m, today);
  const weekStart = (profile.week_start === 0 ? 0 : 1) as 0 | 1;
  const weeks = monthGrid(month, weekStart);
  const dates = weeks.flat().filter((d): d is string => d !== null);
  const [summaries, cells, first] = await Promise.all([getHabitSummaries(), getCalendarCells(dates[0], dates[dates.length - 1]), getFirstHabitStart()]);
  const days = Object.fromEntries(summarizeDays(cells, summaries));
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const hasPrev = first !== null && first.slice(0, 7) <= prev;
  const hasNext = next <= today.slice(0, 7);

  return (
    <section className="flex flex-col gap-section py-section">
      <div className="flex items-center justify-between gap-inner">
        <h1 className="text-xl font-bold">{t("progress.calendar.title")}</h1>
        {/* -me-inner: the link's padding, so its words line up with the page edge (a 44 px target). */}
        <Link href="/progress" className="-me-inner flex h-11 items-center rounded-full px-inner text-sm font-semibold text-primary hover:bg-muted">
          {t("progress.back")}
        </Link>
      </div>
      {/* The month is one picture, not a card around it (docs/design.md: a single stat is not a card). */}
      <div className="flex flex-col gap-item">
        <nav aria-label={t("progress.calendar.monthLabel")} className="flex items-center justify-between">
          {hasPrev ? (
            <Link href={`/progress/calendar?m=${prev}`} aria-label={t("progress.calendar.previousMonth", { month: monthName(prev) })} className={`${NAV} hover:bg-muted`}>
              <ChevronLeft aria-hidden className="size-5 rtl:-scale-x-100" />
              <LinkPending className="rounded-full" />
            </Link>
          ) : (
            <span className="size-11" />
          )}
          <h2 className="font-bold">{monthName(month)}</h2>
          {hasNext ? (
            <Link href={`/progress/calendar?m=${next}`} aria-label={t("progress.calendar.nextMonth", { month: monthName(next) })} className={`${NAV} hover:bg-muted`}>
              <ChevronRight aria-hidden className="size-5 rtl:-scale-x-100" />
              <LinkPending className="rounded-full" />
            </Link>
          ) : (
            <span className="size-11" />
          )}
        </nav>
        <MonthCalendar key={month} weeks={weeks} weekStart={weekStart} today={today} days={days} />
      </div>
    </section>
  );
}
