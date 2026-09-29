import type { HabitPeriod } from "@/lib/habit-schema";

// The shape of public.week_overview() (a jsonb object, so the generated type is just `Json`).
export type DayCellStatus = "done" | "missed" | "paused" | "not_started" | "open";
export type WeekDay = { local_date: string; daily_done: number; daily_possible: number };
export type HabitCells = { habit_id: string; cells: { period_start: string; status: DayCellStatus }[] };
export type WeekOverview = {
  today: string;
  week_start: string;
  done: number;
  possible: number;
  prev_done: number;
  prev_possible: number;
  days: WeekDay[];
  best_current_streak: number;
  best_current_streak_title: string | null;
  best_current_streak_period: HabitPeriod | null;
  check_ins: number;
  active_habits: number;
  per_habit: HabitCells[];
};

// Show the overview as soon as there's an active habit, so a new user sees "0 of 3" on day one.
export const hasWeekData = (o: Pick<WeekOverview, "done" | "possible" | "active_habits">) =>
  o.active_habits > 0 || o.possible > 0 || o.done > 0;

// The database counts only finished periods, plus anything already done today. For display,
// today's daily habits that are still to do also count as possible, so the week reads
// "2 of 5" in the morning instead of "0 of 0".
export function withTodayPending(o: WeekOverview): WeekOverview {
  const today = o.days.find((d) => d.local_date === o.today);
  const pending = today ? Math.max(0, today.daily_possible - today.daily_done) : 0;
  return { ...o, possible: o.possible + pending };
}

// Only positive or neutral. "More than last week" needs a last week to compare with. "Best week
// yet" means this week's share done beats last week's (the only other week in the data), while
// having done at least as much.
export function comparisonLine(o: Pick<WeekOverview, "done" | "possible" | "prev_done" | "prev_possible">): string {
  if (o.prev_possible > 0 && o.done > o.prev_done) {
    return `${o.done - o.prev_done} more than last week`;
  }
  if (
    o.prev_possible > 0 &&
    o.possible > 0 &&
    o.done > 0 &&
    o.done === o.prev_done &&
    o.done * o.prev_possible > o.prev_done * o.possible
  ) {
    return "Your best week yet";
  }
  if (o.done === 0) return "A fresh start this week";
  return `${o.done} done this week`;
}

// Ring maths: the filled share of a circle, clamped to [0, 1]; nothing possible reads as empty.
export function ringFraction(done: number, possible: number): number {
  if (possible <= 0) return 0;
  return Math.min(1, Math.max(0, done / possible));
}

// stroke-dasharray / stroke-dashoffset for a ring of radius r.
export function ringDash(done: number, possible: number, r: number): { circumference: number; offset: number } {
  const circumference = 2 * Math.PI * r;
  return { circumference, offset: circumference * (1 - ringFraction(done, possible)) };
}

const UNIT: Record<HabitPeriod, [string, string]> = { day: ["day", "days"], week: ["week", "weeks"], month: ["month", "months"] };
export const streakUnit = (n: number, period: HabitPeriod | null) => UNIT[period ?? "day"][n === 1 ? 0 : 1];
