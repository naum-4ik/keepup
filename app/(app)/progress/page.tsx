import Link from "next/link";
import { ChartColumn } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Surface } from "@/components/ui/surface";
import { HabitEmoji } from "@/components/habits/category-icon";
import { StreakBadge } from "@/components/habits/streak-badge";
import { HabitDots, WeekCard } from "@/components/overview/week-overview";
import { Button } from "@/components/ui/button";
import { categoryLabel, CATEGORY_ORDER } from "@/lib/categories";
import { dayDetail } from "@/lib/day-detail";
import { getProfile } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { hasEnded } from "@/lib/habit-end";
import { getFinishedIds, getGroupTimezones, getHabitEnds, getHabitSummaries, getMyCheckIns, getWeekOverview } from "@/lib/habits";
import { inProgressTab, type ProgressTab } from "@/lib/progress-lists";
import { RestoreHabitButton } from "@/components/habits/restore-habit-button";
import { StartAgainButton } from "@/components/habits/start-again-button";
import { getT } from "@/lib/i18n/server";
import { describeSchedule } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { hasWeekData, noStreakKind, noStreakLine, streakSpan } from "@/lib/week-overview";

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const { t } = await getT();
  const showFinished = view === "finished";
  const showArchived = view === "archived" || showFinished;
  const tab: ProgressTab = showFinished ? "finished" : showArchived ? "archived" : "active";
  const [summaries, overview, finishedIds, { profile }] = await Promise.all([getHabitSummaries(), getWeekOverview(), getFinishedIds(), getProfile()]);
  // Past its end, in the habit's own calendar (a group habit runs on the group's zone): not Active
  // any more (lib/progress-lists.ts). Finished habits (ideas/habit-end-date.md) are archived too;
  // they get their own tab.
  const running = summaries.filter((h) => !h.archived_at);
  const [ends, zones] = await Promise.all([getHabitEnds(running.map((h) => h.habit_id)), getGroupTimezones(running.map((h) => h.group_id))]);
  const ended = (h: (typeof summaries)[number]) => hasEnded(ends.get(h.habit_id), todayIn((h.group_id && zones.get(h.group_id)) || profile.timezone));
  const habits = summaries.filter((h) => inProgressTab(h, tab, finishedIds, ended));
  const cellsFor = new Map((overview?.per_habit ?? []).map((p) => [p.habit_id, p.cells]));
  const categories = CATEGORY_ORDER.filter((c) => habits.some((h) => h.category === c));
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
    <section className="flex flex-col gap-section py-section">
      <div className="flex items-center justify-between gap-inner">
        <h1 className="text-xl font-bold">{t("progress.title")}</h1>
        {/* -me-inner: the link's padding, so its words line up with the page edge (a 44 px target). */}
        <Link href="/progress/recaps" className="-me-inner flex h-11 items-center rounded-full px-inner text-sm font-semibold text-primary hover:bg-muted">{t("progress.recaps")}</Link>
      </div>
      {!showArchived && overview && hasWeekData(overview) && (
        <WeekCard t={t} overview={overview} days={days} noStreak={noStreakLine(t, noStreakKind(active))} />
      )}

      {/* The same segmented look as Inbox's tabs: filled pills read as primary buttons. A 4 px track
          around the pills, off the scale on purpose (one control, like a switch). */}
      <nav aria-label={t("progress.listLabel")} className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
        {[
          { href: "/progress", label: t("progress.tabs.active"), current: !showArchived },
          { href: "/progress?view=finished", label: t("progress.tabs.finished"), current: showFinished },
          { href: "/progress?view=archived", label: t("progress.tabs.archived"), current: showArchived && !showFinished },
        ].map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.current ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center justify-center rounded-lg text-sm font-semibold",
              tab.current ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {habits.length === 0 ? (
        <EmptyState
          icon={<ChartColumn className="size-6" />}
          action={
            showArchived ? (
              // Finished and Archived fill up from the Active tab: the way back there.
              <Button asChild variant="outline">
                <Link href="/progress">{t("progress.empty.showActive")}</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/habits/new">{t("common.addHabit")}</Link>
              </Button>
            )
          }
        >
          {showFinished ? t("progress.empty.finished") : showArchived ? t("progress.empty.archived") : t("progress.empty.active")}
        </EmptyState>
      ) : (
        categories.map((c) => (
          <section key={c} aria-labelledby={`cat-${c}-title`} className="flex flex-col gap-inner">
            <h2 id={`cat-${c}-title`} className="text-sm font-bold text-muted-foreground">{categoryLabel(t, c)}</h2>
            <ul className="flex flex-col gap-item">
              {habits
                .filter((h) => h.category === c)
                .map((h) => (
                  // The row opens the habit (a Surface link). Restore / Start again sit beside it, not
                  // inside: a button can't live in a link.
                  <li key={h.habit_id} className="flex items-center gap-inner">
                    <Surface as="a" href={`/habits/${h.habit_id}`} className="flex min-w-0 flex-1 items-center gap-item">
                      <HabitEmoji category={h.category} emoji={h.emoji} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex min-w-0 items-center gap-inner">
                          <span className="truncate font-bold">{h.title}</span>
                          {h.group_name && (
                            // A chip: 8 px sides, 2 px tall padding (a pill around one word, off the scale on purpose).
                            <span className="max-w-[45%] shrink-0 truncate rounded-full bg-accent px-inner py-0.5 text-xs font-semibold text-accent-foreground">
                              {h.group_name}
                            </span>
                          )}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {t("progress.habitLine", {
                            ended: !h.archived_at && ended(h) ? "yes" : "no",
                            schedule: describeSchedule(t, h.target_count, h.period),
                            best: h.best_streak > 0 ? "yes" : "no",
                            span: h.best_streak > 0 ? streakSpan(t, h.best_streak, h.period) : "",
                          })}
                        </span>
                        {cellsFor.has(h.habit_id) && (
                          <span className="pt-inner">
                            <HabitDots t={t} cells={cellsFor.get(h.habit_id)!} category={h.category} period={h.period} />
                          </span>
                        )}
                      </span>
                      <StreakBadge count={h.current_streak} />
                    </Surface>
                    {showFinished && h.archived_at && (!h.group_id || h.my_role === "admin") && (
                      <span className="shrink-0">
                        <StartAgainButton habitId={h.habit_id} title={h.title} />
                      </span>
                    )}
                    {showArchived && !showFinished && (!h.group_id || h.my_role === "admin") && (
                      <span className="shrink-0">
                        <RestoreHabitButton habitId={h.habit_id} title={h.title} />
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
