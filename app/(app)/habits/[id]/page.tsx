import { notFound } from "next/navigation";
import { ArchiveHabitButton } from "@/components/habits/archive-habit-button";
import { CategoryIcon } from "@/components/habits/category-icon";
import { CheckInButton } from "@/components/habits/check-in-button";
import { CheckInList } from "@/components/habits/check-in-list";
import { DeleteHabitButton } from "@/components/habits/delete-habit-button";
import { FreezeForm } from "@/components/habits/freeze-form";
import { HabitDetailsForm } from "@/components/habits/habit-details-form";
import { HistoryGrid } from "@/components/habits/history-grid";
import { getProfile } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { isUuid } from "@/lib/habit-schema";
import { getHabitDetail } from "@/lib/habits";
import { checkInState, describeProgress, describeSchedule } from "@/lib/schedule";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-soft">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

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

  return (
    <section className="flex flex-col gap-4 py-6">
      <header className="flex items-center gap-4">
        <CategoryIcon category={h.category} size="lg" />
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-xl font-bold">{h.title}</h1>
          <p className="text-sm text-muted-foreground">
            {describeSchedule(h.target_count, h.period)}
            {archived ? " · Archived" : ` · ${progress.text}`}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-card p-4 shadow-soft">
          <p className="text-2xl font-extrabold tabular-nums text-[#E8804F]">{h.current_streak}</p>
          <p className="text-xs font-semibold text-muted-foreground">Current streak</p>
        </div>
        <div className="rounded-2xl bg-card p-4 shadow-soft">
          <p className="text-2xl font-extrabold tabular-nums">{h.best_streak}</p>
          <p className="text-xs font-semibold text-muted-foreground">Best streak</p>
        </div>
      </div>

      <Card title="History">
        <HistoryGrid cells={history} period={h.period} />
      </Card>

      {!archived && (
        <>
          <Card title="This period">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm">{progress.text}</p>
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

          <Card title="Pause">
            <FreezeForm habitId={h.habit_id} today={today} weekStart={weekStart} activeFreeze={activeFreeze} />
          </Card>

          <Card title="Details">
            <HabitDetailsForm
              habitId={h.habit_id}
              title={h.title}
              category={h.category}
              startsOn={h.starts_on}
              canEditStart={totalCheckIns === 0}
              today={today}
              weekStart={weekStart}
            />
          </Card>

          <Card title={totalCheckIns === 0 ? "Delete" : "Archive"}>
            {totalCheckIns === 0 ? (
              <DeleteHabitButton habitId={h.habit_id} title={h.title} />
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">Archived habits keep their history but leave Today.</p>
                <ArchiveHabitButton habitId={h.habit_id} title={h.title} />
              </div>
            )}
          </Card>
        </>
      )}
    </section>
  );
}
