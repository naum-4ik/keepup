import type { HabitCategory, HabitPeriod } from "@/lib/habit-schema";
import { groupForToday } from "@/lib/today";

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
export function todayProgress(habits: ProgressHabit[]): { done: number; total: number; items: TodayItem[] } {
  const { todo, done } = groupForToday(habits);
  const doneIds = new Set(done.map((x) => x.habit_id));
  const items = habits
    .filter((x) => doneIds.has(x.habit_id) || todo.includes(x))
    .map((x) => ({ habitId: x.habit_id, title: x.title, emoji: x.emoji, category: x.category, done: doneIds.has(x.habit_id) }));
  return { done: done.length, total: items.length, items };
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
