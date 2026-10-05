import type { HabitCategory, HabitPeriod } from "@/lib/habit-schema";
import { withQueuedTaps } from "@/lib/offline-sync";
import { groupForToday, stateOf } from "@/lib/today";

export type ProgressHabit = {
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
  requires_approval?: boolean | null;
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

// Taps still waiting on this phone (lib/offline-queue.ts queuedDelta, mine only) count as the
// check-ins they will be, never past the target: one on an approval habit waits for a yes (pending,
// not done), so "all done" and its confetti still wait for it, as they will once it is sent. A
// waiting undo of a tap the page already counts takes it back (never below zero).
export function withQueuedProgress<T extends ProgressHabit>(habits: T[], queued: ReadonlyMap<string, number>): T[] {
  if (queued.size === 0) return habits;
  const counted = habits.map((h) => ({
    id: h.habit_id, done: h.done_count + (h.pending_count ?? 0), target: h.target_count, state: "open", habit: h,
  }));
  return withQueuedTaps(counted, queued).habits.map((c, i) => {
    const h = c.habit;
    const extra = c.done - counted[i].done;
    if (extra === 0) return h;
    if (extra > 0) {
      return h.requires_approval
        ? { ...h, checked_in_today: true, pending_count: (h.pending_count ?? 0) + extra }
        : { ...h, checked_in_today: true, done_count: h.done_count + extra };
    }
    // An undo: the taken-back tap was today's (taps wait on the phone for minutes, not days). A daily
    // habit still checked in today keeps its other taps; any other habit is open again today.
    const pending = Math.max(0, (h.pending_count ?? 0) + (h.requires_approval ? extra : 0));
    const done = Math.max(0, h.done_count + (h.requires_approval ? Math.min(0, (h.pending_count ?? 0) + extra) : extra));
    return { ...h, done_count: done, pending_count: pending, checked_in_today: h.period === "day" && done + pending > 0 };
  });
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
