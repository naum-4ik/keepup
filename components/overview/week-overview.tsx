import Link from "next/link";
import { CalendarDays, Check, Flame, ListChecks } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import type { HabitCategory, HabitPeriod } from "@/lib/habit-schema";
import { comparisonLine, goalsMet, ringDash, streakSpan, type DayCellStatus, type HabitCells, type WeekOverview } from "@/lib/week-overview";
import type { T } from "@/supabase/functions/_shared/i18n";
import { cn } from "@/lib/utils";
import type { DayRow } from "@/lib/day-detail";
import { WeekDays } from "@/components/overview/week-days";
import { Section } from "@/components/ui/section";

const STREAK = "text-flame";

export function ProgressRing({
  done,
  possible,
  size = 20,
  label,
}: {
  done: number;
  possible: number;
  size?: number;
  label: string;
}) {
  const stroke = Math.max(2.5, size / 8);
  const r = (size - stroke) / 2;
  const { circumference, offset } = ringDash(done, possible, r);
  // A full ring would look like an empty outline, so a complete week becomes a filled sage check.
  // The check means "all done so far": `possible` only counts periods that are due or finished, so
  // it can show mid-week and give way to the ring again once the next day's habits come due.
  if (possible > 0 && done >= possible) {
    return (
      <span role="img" data-complete="" aria-label={label} style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-full bg-done text-done-foreground">
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

// Progress: "Your week", a headed section, not a card (docs/design.md: a single stat is a line).
// The heading row carries the Calendar link, so the headline gets the full width at 320 px.
// `days`: each past or current day's list for "tap a day" (Progress); without it the days aren't tappable.
// `noStreak`: what starts a streak when there is none (lib/week-overview.ts noStreakLine).
export function WeekCard({ t, overview: o, days, noStreak }: { t: T; overview: WeekOverview; days?: Record<string, DayRow[]>; noStreak: string }) {
  const streak = o.best_current_streak;
  const line = comparisonLine(t, o);
  return (
    <Section
      title={t("overview.yourWeek")}
      action={
        days && (
          // -me-inner: the link's padding, so its words line up with the page edge (a 44 px target).
          <Link href="/progress/calendar" className="-me-inner flex h-11 shrink-0 items-center gap-inner rounded-full px-inner text-sm font-semibold text-primary hover:bg-muted">
            <CalendarDays aria-hidden className="size-4" />
            {t("overview.calendar")}
          </Link>
        )
      }
    >
      <div className="flex items-center gap-item">
        <ProgressRing done={o.done} possible={o.possible} size={52} label={t("weekOverview.ringLabel", { goals: goalsMet(t, o.done, o.possible) })} />
        <div className="flex min-w-0 flex-col">
          <p className="text-lg font-bold tabular-nums">{goalsMet(t, o.done, o.possible)}</p>
          {line && <p className="text-sm text-muted-foreground">{line}</p>}
        </div>
      </div>

      <WeekDays days={o.days} today={o.today} details={days} />

      {/* The week's numbers as one line that wraps, not three stat tiles. Icon to number: 4 px, off
          the scale on purpose (one glyph pair, as in StreakBadge). */}
      <ul className="flex flex-wrap gap-x-item gap-y-inner text-sm text-muted-foreground">
        <li className="flex min-w-0 items-center gap-1">
          <Flame className={cn("size-4 shrink-0", streak > 0 ? cn(STREAK, "fill-current") : "")} aria-hidden />
          {streak > 0 ? (
            <span className="min-w-0 truncate">
              <span className={cn("font-bold tabular-nums", STREAK)}>{streakSpan(t, streak, o.best_current_streak_period)}</span>
              {o.best_current_streak_title && <> · <bdi>{o.best_current_streak_title}</bdi></>}
            </span>
          ) : (
            <span>{noStreak}</span>
          )}
        </li>
        <li className="flex items-center gap-1">
          <Check className="size-4 text-primary" aria-hidden />
          <span>
            <span className="font-bold text-foreground tabular-nums">{o.check_ins}</span> {t("overview.checkIns", { n: o.check_ins })}
          </span>
        </li>
        <li className="flex items-center gap-1">
          <ListChecks className="size-4 text-primary" aria-hidden />
          <span>
            <span className="font-bold text-foreground tabular-nums">{o.active_habits}</span> {t("overview.activeHabits", { n: o.active_habits })}
          </span>
        </li>
      </ul>
    </Section>
  );
}

const DOT: Record<HabitCells["cells"][number]["status"], string> = {
  done: "bg-current",
  missed: "bg-muted-foreground/30",
  paused: "bg-frozen/40",
  not_started: "border border-input",
  open: "border border-input",
  rested: "bg-done/40",
};

// Progress rows: the last 7 days (or up to 7 weeks / months), oldest first.
export function HabitDots({ t, cells, category, period }: { t: T; cells: HabitCells["cells"]; category: HabitCategory; period: HabitPeriod }) {
  if (cells.length === 0) return null;
  const counts = new Map<DayCellStatus, number>();
  for (const c of cells) counts.set(c.status, (counts.get(c.status) ?? 0) + 1);
  const label = t("weekOverview.dotsLabel", {
    period,
    n: cells.length,
    counts: [...counts].map(([status, n]) => t("weekOverview.dotCount", { status, n })).join(t("common.listSeparator")),
  });
  return (
    <span role="img" aria-label={label} className={cn("flex gap-1", CATEGORIES[category].iconClass)}>
      {cells.map((c) => (
        <span key={c.period_start} data-status={c.status} className={cn("size-2.5 rounded-full", DOT[c.status])} />
      ))}
    </span>
  );
}
