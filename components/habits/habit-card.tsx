import Link from "next/link";
import { CategoryIcon } from "@/components/habits/category-icon";
import { CheckInButton } from "@/components/habits/check-in-button";
import { StreakBadge } from "@/components/habits/streak-badge";
import type { HabitSummary } from "@/lib/habits";
import { describeProgress } from "@/lib/schedule";
import { stateOf } from "@/lib/today";
import { cn } from "@/lib/utils";

export function HabitCard({ habit }: { habit: HabitSummary }) {
  const progress = describeProgress({
    targetCount: habit.target_count,
    period: habit.period,
    doneCount: habit.done_count,
    daysLeft: habit.days_left,
    frozen: habit.frozen,
    frozenUntil: habit.frozen_until,
    notStarted: habit.not_started,
    startsOn: habit.starts_on,
  });
  const showBar = habit.period === "day" && habit.target_count > 1 && !habit.frozen;

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-3.5 shadow-soft">
      <Link href={`/habits/${habit.habit_id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <CategoryIcon category={habit.category} />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-bold">{habit.title}</span>
          <span className={cn("text-sm", progress.atRisk ? "font-semibold text-[#9A6A10]" : "text-muted-foreground")}>
            {progress.text}
          </span>
          {showBar && (
            <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span
                className="block h-full rounded-full bg-[#3B82B8]"
                style={{ width: `${Math.min(100, (habit.done_count / habit.target_count) * 100)}%` }}
              />
            </span>
          )}
        </span>
      </Link>
      <StreakBadge count={habit.current_streak} />
      <CheckInButton
        habitId={habit.habit_id}
        title={habit.title}
        multi={habit.target_count > 1}
        state={stateOf(habit)}
      />
    </div>
  );
}
