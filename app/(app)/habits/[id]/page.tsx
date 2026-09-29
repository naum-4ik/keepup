import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, ChevronLeft, Flame, Trophy } from "lucide-react";
import { ArchiveHabitButton } from "@/components/habits/archive-habit-button";
import { CategoryIcon } from "@/components/habits/category-icon";
import { CheckInButton } from "@/components/habits/check-in-button";
import { CheckInList } from "@/components/habits/check-in-list";
import { DeleteHabitButton } from "@/components/habits/delete-habit-button";
import { FreezeForm } from "@/components/habits/freeze-form";
import { HabitDetailsForm } from "@/components/habits/habit-details-form";
import { HistoryGrid } from "@/components/habits/history-grid";
import { getProfile } from "@/lib/auth";
import { CATEGORIES } from "@/lib/categories";
import { todayIn } from "@/lib/dates";
import { isUuid, type HabitPeriod } from "@/lib/habit-schema";
import { getHabitDetail } from "@/lib/habits";
import { checkInState, describeProgress, describeSchedule } from "@/lib/schedule";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-soft">
      <h2 className="text-sm font-bold text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

// Settings the user rarely needs sit behind a row they can open, so the page leads with today.
function Manage({ title, hint, danger, children }: { title: string; hint: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <details className="group border-t border-border first:border-t-0">
      <summary className="flex min-h-14 list-none items-center gap-3 px-5 py-3 hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={danger ? "font-bold text-destructive" : "font-bold"}>{title}</span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </span>
        <ChevronDown aria-hidden className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-5 pt-1 pb-5">{children}</div>
    </details>
  );
}

const UNIT: Record<HabitPeriod, [string, string]> = { day: ["day", "days"], week: ["week", "weeks"], month: ["month", "months"] };
const unit = (n: number, period: HabitPeriod) => UNIT[period][n === 1 ? 0 : 1];
const PERIOD_TITLE: Record<HabitPeriod, string> = { day: "Today", week: "This week", month: "This month" };

export default async function HabitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [{ profile }, detail] = await Promise.all([getProfile(), getHabitDetail(id)]);
  if (!detail) notFound();

  const { summary: h, history, freezes, checkIns, totalCheckIns } = detail;
  const today = todayIn(profile.timezone);
  const weekStart = profile.week_start === 0 ? 0 : 1;
  const activeFreeze = freezes.find((f) => !f.ends_on || f.ends_on >= today) ?? null;
  const archived = Boolean(h.archived_at);
  const progress = describeProgress({
    targetCount: h.target_count,
    period: h.period,
    doneCount: h.done_count,
    daysLeft: h.days_left,
    frozen: h.frozen,
    frozenUntil: h.frozen_until,
    notStarted: h.not_started,
    startsOn: h.starts_on,
  });

  const isDone = h.done_count >= h.target_count;

  return (
    <section className="flex flex-col gap-4 pt-2 pb-6">
      <Link href="/today" className="-ml-2 flex h-11 w-fit items-center gap-1 rounded-full px-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
        <ChevronLeft aria-hidden className="size-4" />
        Today
      </Link>

      <header className="flex items-center gap-4">
        <CategoryIcon category={h.category} size="lg" />
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-xl font-bold">{h.title}</h1>
          <p className="text-sm text-muted-foreground">
            {describeSchedule(h.target_count, h.period)} · {CATEGORIES[h.category].label}
            {archived && " · Archived"}
          </p>
        </div>
      </header>

      {!archived && (
        <Card title={PERIOD_TITLE[h.period]}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <p className={isDone ? "font-bold text-[#4F8A5B]" : "font-bold"}>{progress.text}</p>
              {h.target_count > 1 && (
                <div className="h-2 w-40 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div className={`h-full rounded-full bg-current ${CATEGORIES[h.category].iconClass}`} style={{ width: `${Math.min(100, (h.done_count / h.target_count) * 100)}%` }} />
                </div>
              )}
            </div>
            <CheckInButton
              habitId={h.habit_id}
              title={h.title}
              multi={h.target_count > 1}
              state={checkInState({
                targetCount: h.target_count,
                period: h.period,
                doneCount: h.done_count,
                checkedInToday: h.checked_in_today,
                frozen: h.frozen,
                notStarted: h.not_started,
              })}
            />
          </div>
          <CheckInList habitId={h.habit_id} checkIns={checkIns} timeZone={profile.timezone} period={h.period} />
        </Card>
      )}

      <section aria-label="Streaks" className="grid grid-cols-2 divide-x divide-border rounded-2xl bg-card py-4 shadow-soft">
        <div className="flex flex-col items-center gap-0.5">
          <p className="flex items-center gap-1 text-2xl font-extrabold tabular-nums text-[#E8804F]">
            <Flame aria-hidden className="size-5" />
            {h.current_streak}
            <span className="text-sm font-bold">{unit(h.current_streak, h.period)}</span>
          </p>
          <p className="text-xs font-semibold text-muted-foreground">Current streak</p>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <p className="flex items-center gap-1 text-2xl font-extrabold tabular-nums">
            <Trophy aria-hidden className="size-5 text-muted-foreground" />
            {h.best_streak}
            <span className="text-sm font-bold">{unit(h.best_streak, h.period)}</span>
          </p>
          <p className="text-xs font-semibold text-muted-foreground">Best streak</p>
        </div>
      </section>

      <Card title="History">
        <HistoryGrid cells={history} period={h.period} />
      </Card>

      {!archived && (
        <section aria-label="Manage habit" className="overflow-hidden rounded-2xl bg-card shadow-soft">
          <Manage
            title={activeFreeze ? (activeFreeze.starts_on > today ? "Pause scheduled" : "Paused") : "Pause"}
            hint={activeFreeze ? "Resume or cancel the pause" : "Going away? Your streak waits for you"}
          >
            <FreezeForm habitId={h.habit_id} today={today} weekStart={weekStart} activeFreeze={activeFreeze} />
          </Manage>
          <Manage title="Edit details" hint={totalCheckIns === 0 ? "Title, category and start date" : "Title and category"}>
            <HabitDetailsForm
              habitId={h.habit_id}
              title={h.title}
              category={h.category}
              startsOn={h.starts_on}
              canEditStart={totalCheckIns === 0}
              today={today}
              weekStart={weekStart}
            />
          </Manage>
          {totalCheckIns === 0 ? (
            <Manage title="Delete" hint="It has no check-ins yet, so nothing is lost" danger>
              <DeleteHabitButton habitId={h.habit_id} title={h.title} />
            </Manage>
          ) : (
            <Manage title="Archive" hint="Keeps its history, leaves Today" danger>
              <ArchiveHabitButton habitId={h.habit_id} title={h.title} />
            </Manage>
          )}
        </section>
      )}
    </section>
  );
}
