import Link from "next/link";
import { HabitEmoji } from "@/components/habits/category-icon";
import { StreakBadge } from "@/components/habits/streak-badge";
import { HabitDots, WeekCard } from "@/components/overview/week-overview";
import { Button } from "@/components/ui/button";
import { CATEGORIES, CATEGORY_ORDER } from "@/lib/categories";
import { dayDetail } from "@/lib/day-detail";
import { getFinishedIds, getHabitSummaries, getMyCheckIns, getWeekOverview } from "@/lib/habits";
import { StartAgainButton } from "@/components/habits/start-again-button";
import type { HabitPeriod } from "@/lib/habit-schema";
import { describeSchedule } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { hasWeekData } from "@/lib/week-overview";

const UNIT: Record<HabitPeriod, [string, string]> = { day: ["day", "days"], week: ["week", "weeks"], month: ["month", "months"] };

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const showFinished = view === "finished";
  const showArchived = view === "archived" || showFinished;
  const [summaries, overview, finishedIds] = await Promise.all([getHabitSummaries(), getWeekOverview(), getFinishedIds()]);
  // Finished habits (ideas/habit-end-date.md) are archived too; they get their own tab.
  const habits = summaries.filter(
    (h) => Boolean(h.archived_at) === showArchived && (!showArchived || finishedIds.has(h.habit_id) === showFinished),
  );
  const cellsFor = new Map((overview?.per_habit ?? []).map((p) => [p.habit_id, p.cells]));
  // Tap a day: each day up to today, from the overview's cells plus my check-ins that week.
  const week = overview?.days ?? [];
  const checkIns = week.length > 0 ? await getMyCheckIns(week[0].local_date, week[week.length - 1].local_date) : [];
  const active = summaries.filter((h) => !h.archived_at);
  const days = overview
    ? Object.fromEntries(
        week.filter((d) => d.local_date <= overview.today).map((d) => [d.local_date, dayDetail(d.local_date, active, overview.per_habit, checkIns)]),
      )
    : undefined;

  return (
    <section className="flex flex-col gap-5 py-6">
      <h1 className="text-xl font-bold">Progress</h1>
      {!showArchived && overview && hasWeekData(overview) && <WeekCard overview={overview} days={days} />}

      {/* The same segmented look as Inbox's tabs: filled pills read as primary buttons. */}
      <nav aria-label="Habit list" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
        {[
          { href: "/progress", label: "Active", current: !showArchived },
          { href: "/progress?view=finished", label: "Finished", current: showFinished },
          { href: "/progress?view=archived", label: "Archived", current: showArchived && !showFinished },
        ].map((t) => (
          <Link
            key={t.label}
            href={t.href}
            aria-current={t.current ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center justify-center rounded-lg text-sm font-semibold",
              t.current ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {habits.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-8 text-center shadow-soft">
          <p className="text-sm text-muted-foreground">
            {showFinished ? "No finished habits yet. Give a habit an end, like 30 days." : showArchived ? "No archived habits." : "No habits yet."}
          </p>
          {!showArchived && (
            <Button asChild className="h-11">
              <Link href="/habits/new">Add a habit</Link>
            </Button>
          )}
        </div>
      ) : (
        CATEGORY_ORDER.filter((c) => habits.some((h) => h.category === c)).map((c) => (
          <section key={c} className="flex flex-col gap-2">
            <h2 className="text-sm font-bold text-muted-foreground">{CATEGORIES[c].label}</h2>
            <ul className="flex flex-col gap-2">
              {habits
                .filter((h) => h.category === c)
                .map((h) => (
                  <li key={h.habit_id} className="flex items-center rounded-2xl bg-card shadow-soft">
                    <Link href={`/habits/${h.habit_id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-3.5 hover:bg-muted/60">
                      <HabitEmoji category={h.category} emoji={h.emoji} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-bold">{h.title}</span>
                          {h.group_name && (
                            <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                              {h.group_name}
                            </span>
                          )}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {describeSchedule(h.target_count, h.period)}
                          {h.best_streak > 0 && ` · best ${h.best_streak} ${UNIT[h.period][h.best_streak === 1 ? 0 : 1]}`}
                        </span>
                        {cellsFor.has(h.habit_id) && (
                          <span className="pt-1.5">
                            <HabitDots cells={cellsFor.get(h.habit_id)!} category={h.category} period={h.period} />
                          </span>
                        )}
                      </span>
                      <StreakBadge count={h.current_streak} />
                    </Link>
                    {showFinished && (
                      <span className="shrink-0 pr-2">
                        <StartAgainButton habitId={h.habit_id} title={h.title} />
                      </span>
                    )}
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}
