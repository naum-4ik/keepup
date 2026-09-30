import Link from "next/link";
import { CalendarDays, Check, ChevronRight, Flame, ListChecks } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import type { HabitCategory, HabitPeriod } from "@/lib/habit-schema";
import { comparisonLine, ringDash, streakUnit, type HabitCells, type WeekOverview } from "@/lib/week-overview";
import { cn } from "@/lib/utils";
import type { DayRow } from "@/lib/day-detail";
import { WeekDays } from "@/components/overview/week-days";

const STREAK = "text-[#E8804F]";

export function ProgressRing({
  done,
  possible,
  size = 20,
  label = `${done} of ${possible} done this week`,
}: {
  done: number;
  possible: number;
  size?: number;
  label?: string;
}) {
  const stroke = Math.max(2.5, size / 8);
  const r = (size - stroke) / 2;
  const { circumference, offset } = ringDash(done, possible, r);
  // A full ring would look like an empty outline, so a complete week becomes a filled sage check.
  // The check means "all done so far": `possible` only counts periods that are due or finished, so
  // it can show mid-week and give way to the ring again once the next day's habits come due.
  if (possible > 0 && done >= possible) {
    return (
      <span role="img" data-complete="" aria-label={label} style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-full bg-[#4F8A5B] text-white">
        <Check aria-hidden strokeWidth={3} style={{ width: size * 0.55, height: size * 0.55 }} />
      </span>
    );
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
      {done > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-primary"
        />
      )}
    </svg>
  );
}

// Today: "This week · ◔ 18 of 22 · 🔥 12", linking to Progress.
export function WeekStrip({ overview: o }: { overview: WeekOverview }) {
  return (
    <Link
      href="/progress"
      className="flex min-h-11 items-center gap-2 rounded-2xl bg-card px-4 py-2 text-sm shadow-soft hover:bg-muted/60"
    >
      <span className="font-semibold text-muted-foreground">This week</span>
      <span aria-hidden className="text-muted-foreground">·</span>
      <ProgressRing done={o.done} possible={o.possible} />
      {/* The ring's label says the same for screen readers. */}
      <span aria-hidden className="font-bold tabular-nums">
        {o.done} of {o.possible}
      </span>
      {o.best_current_streak > 0 && (
        <>
          <span aria-hidden className="text-muted-foreground">·</span>
          <span className={cn("flex items-center gap-1 font-bold tabular-nums", STREAK)}>
            <Flame className="size-4 fill-current" aria-hidden />
            <span className="sr-only">Best streak:</span>
            {o.best_current_streak}
          </span>
        </>
      )}
      <ChevronRight className="ml-auto size-4 text-muted-foreground" aria-hidden />
    </Link>
  );
}

// Progress: "Your week" card.
// `days`: each past or current day's list for "tap a day" (Progress); without it the days aren't tappable.
export function WeekCard({ overview: o, days }: { overview: WeekOverview; days?: Record<string, DayRow[]> }) {
  const streak = o.best_current_streak;
  return (
    <section aria-labelledby="your-week" className="flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <ProgressRing done={o.done} possible={o.possible} size={52} />
        <div className="flex min-w-0 flex-col">
          <h2 id="your-week" className="text-sm font-semibold text-muted-foreground">
            Your week
          </h2>
          <p className="text-lg font-bold tabular-nums">
            {o.done} of {o.possible} done
          </p>
          <p className="text-sm text-muted-foreground">{comparisonLine(o)}</p>
        </div>
        {days && (
          <Link href="/progress/calendar" className="ml-auto flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-primary hover:bg-muted">
            <CalendarDays aria-hidden className="size-4" />
            Calendar
          </Link>
        )}
      </div>

      <WeekDays days={o.days} today={o.today} details={days} />

      <ul className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-sm">
        <li className="flex min-w-0 flex-col items-center gap-0.5 text-center">
          <span className={cn("flex items-center gap-1 font-bold tabular-nums", streak > 0 ? STREAK : "text-muted-foreground")}>
            <Flame className={cn("size-4", streak > 0 && "fill-current")} aria-hidden />
            {streak > 0 ? `${streak} ${streakUnit(streak, o.best_current_streak_period)}` : "No streak yet"}
          </span>
          {streak > 0 && o.best_current_streak_title && (
            <span className="w-full truncate text-xs text-muted-foreground">{o.best_current_streak_title}</span>
          )}
        </li>
        <li className="flex flex-col items-center gap-0.5 text-center">
          <span className="flex items-center gap-1 font-bold tabular-nums">
            <Check className="size-4 text-primary" aria-hidden />
            {o.check_ins}
          </span>
          <span className="text-xs text-muted-foreground">{o.check_ins === 1 ? "check-in" : "check-ins"}</span>
        </li>
        <li className="flex flex-col items-center gap-0.5 text-center">
          <span className="flex items-center gap-1 font-bold tabular-nums">
            <ListChecks className="size-4 text-primary" aria-hidden />
            {o.active_habits}
          </span>
          <span className="text-xs text-muted-foreground">{o.active_habits === 1 ? "active habit" : "active habits"}</span>
        </li>
      </ul>
    </section>
  );
}

const DOT: Record<HabitCells["cells"][number]["status"], string> = {
  done: "bg-current",
  missed: "bg-muted-foreground/30",
  paused: "bg-[#5B8DB8]/40",
  not_started: "border border-input",
  open: "border border-input",
};
const DOT_WORD: Record<HabitCells["cells"][number]["status"], string> = {
  done: "done",
  missed: "missed",
  paused: "paused",
  not_started: "not started",
  open: "in progress",
};
const SPAN: Record<HabitPeriod, [string, string]> = { day: ["day", "days"], week: ["week", "weeks"], month: ["month", "months"] };

// Progress rows: the last 7 days (or up to 7 weeks / months), oldest first.
export function HabitDots({ cells, category, period }: { cells: HabitCells["cells"]; category: HabitCategory; period: HabitPeriod }) {
  if (cells.length === 0) return null;
  const counts = new Map<string, number>();
  for (const c of cells) counts.set(DOT_WORD[c.status], (counts.get(DOT_WORD[c.status]) ?? 0) + 1);
  const label = `Last ${cells.length} ${SPAN[period][cells.length === 1 ? 0 : 1]}: ${[...counts].map(([w, n]) => `${n} ${w}`).join(", ")}`;
  return (
    <span role="img" aria-label={label} className={cn("flex gap-1", CATEGORIES[category].iconClass)}>
      {cells.map((c) => (
        <span key={c.period_start} data-status={c.status} className={cn("size-2.5 rounded-full", DOT[c.status])} />
      ))}
    </span>
  );
}
