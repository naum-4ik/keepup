import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { MonthCalendar } from "@/components/overview/month-calendar";
import { getProfile } from "@/lib/auth";
import { monthGrid, parseMonth, shiftMonth, summarizeDays } from "@/lib/calendar";
import { getCalendarCells, getFirstHabitStart, getHabitSummaries } from "@/lib/habits";

const monthName = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, 1)));
};

const NAV = "flex h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const { profile } = await getProfile();
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
    <section className="flex flex-col gap-5 py-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Calendar</h1>
        <Link href="/progress" className="text-sm font-semibold text-primary">
          Back to Progress
        </Link>
      </div>
      <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-soft">
        <nav aria-label="Month" className="flex items-center justify-between">
          {hasPrev ? (
            <Link href={`/progress/calendar?m=${prev}`} aria-label={`Previous month, ${monthName(prev)}`} className={`${NAV} hover:bg-muted`}>
              <ChevronLeft aria-hidden className="size-5" />
            </Link>
          ) : (
            <span className="size-11" />
          )}
          <h2 className="font-bold">{monthName(month)}</h2>
          {hasNext ? (
            <Link href={`/progress/calendar?m=${next}`} aria-label={`Next month, ${monthName(next)}`} className={`${NAV} hover:bg-muted`}>
              <ChevronRight aria-hidden className="size-5" />
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
