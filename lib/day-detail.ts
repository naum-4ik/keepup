import type { HabitCategory, HabitPeriod } from "@/lib/habit-schema";
import type { DayCellStatus, HabitCells } from "@/lib/week-overview";

export type DayHabit = { habit_id: string; title: string; emoji: string | null; category: HabitCategory; period: HabitPeriod; target_count: number };
export type DayCheckIn = { habit_id: string; local_date: string; status: string };
// "checked_in": a weekly or monthly habit with a check-in that day (its period isn't one day).
export type DayRowStatus = Exclude<DayCellStatus, "not_started"> | "checked_in";
export type DayRow = {
  habitId: string;
  title: string;
  emoji: string | null;
  category: HabitCategory;
  status: DayRowStatus;
  count: number;
  pending: number;
};

const ORDER: Record<DayRowStatus, number> = { done: 0, checked_in: 1, open: 2, missed: 3, paused: 4, rested: 5 };

// Progress → tap a day: what you did that day. Daily habits use the day's cell from week_overview;
// weekly and monthly habits appear only when checked in that day.
export function dayDetail(date: string, habits: DayHabit[], perHabit: HabitCells[], checkIns: DayCheckIn[]): DayRow[] {
  const cellsFor = new Map(perHabit.map((p) => [p.habit_id, p.cells]));
  const rows: DayRow[] = [];
  for (const h of habits) {
    const that = checkIns.filter((c) => c.habit_id === h.habit_id && c.local_date === date && (c.status === "approved" || c.status === "pending"));
    const count = that.length;
    const pending = that.filter((c) => c.status === "pending").length;
    let status: DayRowStatus | null = null;
    if (h.period === "day") {
      const cell = cellsFor.get(h.habit_id)?.find((c) => c.period_start === date);
      if (cell && cell.status !== "not_started") status = cell.status;
    } else if (count > 0) {
      status = "checked_in";
    }
    if (status) rows.push({ habitId: h.habit_id, title: h.title, emoji: h.emoji, category: h.category, status, count, pending });
  }
  return rows.sort((a, b) => ORDER[a.status] - ORDER[b.status]);
}
