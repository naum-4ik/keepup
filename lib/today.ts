import { checkInState, type CheckInState } from "@/lib/schedule";
import type { HabitPeriod } from "@/lib/habit-schema";

type TodayHabit = {
  target_count: number;
  period: HabitPeriod;
  done_count: number;
  checked_in_today: boolean;
  frozen: boolean;
  not_started: boolean;
  pending_count?: number | null;
};

export const stateOf = (h: TodayHabit): CheckInState =>
  checkInState({
    targetCount: h.target_count,
    period: h.period,
    doneCount: h.done_count,
    checkedInToday: h.checked_in_today,
    frozen: h.frozen,
    notStarted: h.not_started,
    pendingCount: h.pending_count ?? 0,
  });

// Today reads top to bottom as: what's left to do, what's done, what isn't active yet
// (starts later or paused). Order inside each group is kept.
export function groupForToday<T extends TodayHabit>(habits: T[]): { todo: T[]; done: T[]; later: T[] } {
  const groups = { todo: [] as T[], done: [] as T[], later: [] as T[] };
  for (const h of habits) {
    const s = stateOf(h);
    groups[s === "open" ? "todo" : s === "done" || s === "pending" || s === "checked-today" ? "done" : "later"].push(h);
  }
  return groups;
}

// "All checked off. Nice work." says it once on Today: under the first section with nothing left
// to do and something done. Null when none qualifies.
export function allCheckedOffKey<T extends TodayHabit>(sections: { key: string; habits: T[] }[]): string | null {
  for (const s of sections) {
    const { todo, done } = groupForToday(s.habits);
    if (todo.length === 0 && done.length > 0) return s.key;
  }
  return null;
}

// The "1/3" ring on a weekly or monthly check-in button: partway through a period that needs more
// than one check-in. Daily habits have their own bar; nothing yet or done shows the plain icon.
export function ringOf(h: Pick<TodayHabit, "period" | "target_count" | "done_count">): { done: number; target: number } | null {
  if (h.period === "day" || h.target_count <= 1 || h.done_count <= 0 || h.done_count >= h.target_count) return null;
  return { done: h.done_count, target: h.target_count };
}
