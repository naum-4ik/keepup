import type { HabitCategory, HabitPeriod } from "@/lib/habit-schema";
import { groupForToday, stateOf } from "@/lib/today";

type ProgressHabit = {
  habit_id: string;
  title: string;
  emoji: string | null;
  category: HabitCategory | null;
  target_count: number;
  period: HabitPeriod;
  done_count: number;
  checked_in_today: boolean;
  frozen: boolean;
  not_started: boolean;
  pending_count?: number | null;
};

export type TodayItem = { habitId: string; title: string; emoji: string | null; category: HabitCategory | null; done: boolean };

// The Today card (ideas/today-card.md): the habits on today's lists (to do + done, in page order).
// A check-in waiting for approval isn't done yet: it stays on the "Done for today" list (as
// waiting) but doesn't count here, so "all done" and its confetti wait for the approvals.
export function todayProgress(habits: ProgressHabit[]): { done: number; total: number; items: TodayItem[] } {
  const { todo, done } = groupForToday(habits);
  const listed = new Set([...todo, ...done]);
  // "pending" finishes the period once approved; "checked-today" with a pending check-in (a weekly
  // or monthly habit) is today's only check-in still waiting. pending_count covers the whole period,
  // so an older waiting one also holds today back: the safe side (no early celebration).
  const waiting = (x: ProgressHabit) => stateOf(x) === "pending" || (stateOf(x) === "checked-today" && (x.pending_count ?? 0) > 0);
  const doneIds = new Set(done.filter((x) => !waiting(x)).map((x) => x.habit_id));
  const items = habits
    .filter((x) => listed.has(x))
    .map((x) => ({ habitId: x.habit_id, title: x.title, emoji: x.emoji, category: x.category, done: doneIds.has(x.habit_id) }));
  return { done: doneIds.size, total: items.length, items };
}

// Encouraging, never guilt (docs/design.md voice); at most one emoji.
export function todayLine(done: number, total: number): string {
  const left = total - done;
  if (left <= 0) return "Today's all done 🎉";
  if (done === 0) return `${left} to go today`;
  if (left === 1) return "One more to go!";
  if (done * 2 >= total) return "Halfway there 💪";
  return `${left} to go`;
}
