import Link from "next/link";
import { HabitEmoji } from "@/components/habits/category-icon";
import { CheckInButton } from "@/components/habits/check-in-button";
import { MemberStatusRow } from "@/components/habits/member-status-row";
import { StreakBadge } from "@/components/habits/streak-badge";
import { KidCheckInButton } from "@/components/kids/kid-check-in-button";
import type { HabitSummary } from "@/lib/habits";
import { describeProgress } from "@/lib/schedule";
import { everyoneDidIt, memberStatus, membersOf } from "@/lib/today-sections";
import { stateOf } from "@/lib/today";
import { CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";

type Kid = { id: string; name: string };

function progressOf(habit: HabitSummary) {
  return describeProgress({
    targetCount: habit.target_count,
    period: habit.period,
    doneCount: habit.done_count,
    daysLeft: habit.days_left,
    frozen: habit.frozen,
    frozenUntil: habit.frozen_until,
    notStarted: habit.not_started,
    startsOn: habit.starts_on,
  });
}

// A kid's daily habit reads "1 of 2 today" (spec: Kid profiles); other periods as for adults.
export function kidProgressText(habit: HabitSummary): string {
  if (habit.period !== "day" || habit.frozen || habit.not_started) return progressOf(habit).text;
  return `${Math.min(habit.done_count, habit.target_count)} of ${habit.target_count} today`;
}

// `kid`: the row is the child's (Today's kid section): big emoji, no link to the adult habit page,
// and the check-in is for her. Group copy ("Everyone did it") stays on the group card.
// `endLine`: "Day 12 of 30" for a habit with an end (ideas/habit-end-date.md).
export function HabitCard({ habit, kid, endLine }: { habit: HabitSummary; kid?: Kid; endLine?: string }) {
  if (kid) return <KidHabitCard habit={habit} kid={kid} />;
  const progress = progressOf(habit);
  const showBar = habit.period === "day" && habit.target_count > 1 && !habit.frozen;
  const members = membersOf(habit);
  const everyone = everyoneDidIt(habit);
  // "Me + Mary": children in this habit who still have it open.
  const openChildren = (members ?? [])
    .filter((m) => m.kind === "child" && memberStatus(m, habit.target_count) === "open")
    .map((m) => ({ id: m.profile_id, name: m.name }));

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
          {endLine && (
            <span className={cn("text-xs font-semibold", endLine.startsWith("Almost") ? "text-primary" : "text-muted-foreground")}>
              {endLine}
            </span>
          )}
          {showBar && (
            <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span
                className={cn("block h-full rounded-full bg-current", habit.category ? CATEGORIES[habit.category].iconClass : "text-primary")}
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
        withChildren={openChildren}
      />
    </div>
  );
}

function KidHabitCard({ habit, kid }: { habit: HabitSummary; kid: Kid }) {
  const state = stateOf(habit);
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-3.5 shadow-soft">
      <HabitEmoji category={habit.category} emoji={habit.emoji} size="lg" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-bold">{habit.title}</span>
        <span className={cn("text-sm", state === "done" ? "font-semibold text-[#4F8A5B]" : "text-muted-foreground")}>
          {kidProgressText(habit)}
        </span>
      </span>
      <StreakBadge count={habit.current_streak} />
      <KidCheckInButton
        habitId={habit.habit_id}
        title={habit.title}
        childId={kid.id}
        childName={kid.name}
        multi={habit.target_count > 1}
        state={state}
      />
    </div>
  );
}
