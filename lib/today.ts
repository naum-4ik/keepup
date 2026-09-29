import { checkInState, type CheckInState } from "@/lib/schedule";
import type { HabitPeriod } from "@/lib/habit-schema";

type TodayHabit = {
  target_count: number;
  period: HabitPeriod;
  done_count: number;
  checked_in_today: boolean;
  frozen: boolean;
  not_started: boolean;
};

export const stateOf = (h: TodayHabit): CheckInState =>
  checkInState({
    targetCount: h.target_count,
    period: h.period,
    doneCount: h.done_count,
    checkedInToday: h.checked_in_today,
    frozen: h.frozen,
    notStarted: h.not_started,
  });

// Today reads top to bottom as: what's left to do, what's done, what isn't active yet
// (starts later or paused). Order inside each group is kept.
export function groupForToday<T extends TodayHabit>(habits: T[]): { todo: T[]; done: T[]; later: T[] } {
  const groups = { todo: [] as T[], done: [] as T[], later: [] as T[] };
  for (const h of habits) {
    const s = stateOf(h);
    groups[s === "open" ? "todo" : s === "done" || s === "checked-today" ? "done" : "later"].push(h);
  }
  return groups;
}
