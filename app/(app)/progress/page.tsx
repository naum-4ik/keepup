import Link from "next/link";
import { CategoryIcon } from "@/components/habits/category-icon";
import { StreakBadge } from "@/components/habits/streak-badge";
import { HabitDots, WeekCard } from "@/components/overview/week-overview";
import { Button } from "@/components/ui/button";
import { CATEGORIES, CATEGORY_ORDER } from "@/lib/categories";
import { getHabitSummaries, getWeekOverview } from "@/lib/habits";
import { describeSchedule } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { hasWeekData } from "@/lib/week-overview";

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const showArchived = view === "archived";
  const [summaries, overview] = await Promise.all([getHabitSummaries(), getWeekOverview()]);
  const habits = summaries.filter((h) => Boolean(h.archived_at) === showArchived);
  const cellsFor = new Map(overview.per_habit.map((p) => [p.habit_id, p.cells]));

  return (
    <section className="flex flex-col gap-5 py-6">
      <h1 className="text-xl font-bold">Progress</h1>
      {!showArchived && hasWeekData(overview) && <WeekCard overview={overview} />}

      <nav aria-label="Habit list" className="flex gap-2">
        {[
          { href: "/progress", label: "Active", current: !showArchived },
          { href: "/progress?view=archived", label: "Archived", current: showArchived },
        ].map((t) => (
          <Link
            key={t.label}
            href={t.href}
            aria-current={t.current ? "page" : undefined}
            className={cn(
              "flex h-11 items-center rounded-full px-4 text-sm font-semibold",
              t.current
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground shadow-soft hover:bg-muted hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {habits.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-8 text-center shadow-soft">
          <p className="text-sm text-muted-foreground">{showArchived ? "No archived habits." : "No habits yet."}</p>
          {!showArchived && (
            <Button asChild className="h-11">
              <Link href="/habits/new">Add a habit</Link>
            </Button>
          )}
        </div>
      ) : (
        CATEGORY_ORDER.filter((c) => habits.some((h) => h.category === c)).map((c) => (
          <section key={c} className="flex flex-col gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{CATEGORIES[c].label}</h2>
            <ul className="flex flex-col gap-2">
              {habits
                .filter((h) => h.category === c)
                .map((h) => (
                  <li key={h.habit_id}>
                    <Link href={`/habits/${h.habit_id}`} className="flex items-center gap-3 rounded-2xl bg-card p-3.5 shadow-soft hover:bg-muted/60">
                      <CategoryIcon category={h.category} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-bold">{h.title}</span>
                        <span className="text-sm text-muted-foreground">
                          {describeSchedule(h.target_count, h.period)} · best {h.best_streak}
                        </span>
                        {cellsFor.has(h.habit_id) && (
                          <span className="pt-1.5">
                            <HabitDots cells={cellsFor.get(h.habit_id)!} category={h.category} period={h.period} />
                          </span>
                        )}
                      </span>
                      <StreakBadge count={h.current_streak} />
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}
