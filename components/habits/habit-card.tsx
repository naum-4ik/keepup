import Link from "next/link";
import { HabitEmoji } from "@/components/habits/category-icon";
import { CheckInButton } from "@/components/habits/check-in-button";
import { MemberStatusRow } from "@/components/habits/member-status-row";
import { StreakBadge } from "@/components/habits/streak-badge";
import type { HabitSummary } from "@/lib/habits";
import { describeProgress } from "@/lib/schedule";
import { membersOf } from "@/lib/today-sections";
import { stateOf } from "@/lib/today";
import { CATEGORIES } from "@/lib/categories";
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
  const members = membersOf(habit);
  // A group habit is done when everyone required is; that wins over the user's own count.
  const everyone = Boolean(members && habit.group_done);

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-3.5 shadow-soft">
      <Link href={`/habits/${habit.habit_id}`} className="group flex min-w-0 flex-1 items-center gap-3">
        <HabitEmoji category={habit.category} emoji={habit.emoji} />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-bold group-hover:underline">{habit.title}</span>
          <span
            className={cn(
              "text-sm",
              everyone ? "font-semibold text-[#4F8A5B]" : progress.atRisk ? "font-semibold text-[#9A6A10]" : "text-muted-foreground",
            )}
          >
            {everyone ? "Everyone did it ✓" : progress.text}
          </span>
          {showBar && (
            <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span
                className={cn("block h-full rounded-full bg-current", CATEGORIES[habit.category].iconClass)}
                style={{ width: `${Math.min(100, (habit.done_count / habit.target_count) * 100)}%` }}
              />
            </span>
          )}
          {members && members.length > 0 && <MemberStatusRow members={members} target={habit.target_count} />}
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
