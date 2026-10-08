import { describe, expect, it } from "vitest";
import { dayDetail } from "./day-detail";

const habit = (habit_id: string, period: "day" | "week" | "month", title = habit_id) => ({
  habit_id, title, emoji: null, category: "health" as const, period, target_count: 1,
});
const cells = (habit_id: string, entries: [string, string][]) => ({
  habit_id,
  cells: entries.map(([period_start, status]) => ({ period_start, status: status as "done" })),
});

describe("dayDetail", () => {
  const habits = [habit("read", "day", "Read"), habit("water", "day", "Water"), habit("walk", "day", "Walk"), habit("laundry", "week", "Laundry")];
  const perHabit = [
    cells("read", [["2026-09-29", "done"]]),
    cells("water", [["2026-09-29", "missed"]]),
    cells("walk", [["2026-09-29", "paused"]]),
    cells("laundry", [["2026-09-27", "open"]]),
  ];
  const checkIns = [
    { habit_id: "read", local_date: "2026-09-29", status: "approved" },
    { habit_id: "laundry", local_date: "2026-09-29", status: "approved" },
    { habit_id: "laundry", local_date: "2026-09-29", status: "pending" },
    { habit_id: "laundry", local_date: "2026-09-30", status: "approved" },
    { habit_id: "water", local_date: "2026-09-29", status: "rejected" },
  ];

  it("lists what was done first, then what wasn't, then pauses", () => {
    expect(dayDetail("2026-09-29", habits, perHabit, checkIns).map((r) => `${r.title}:${r.status}`)).toEqual([
      "Read:done", "Laundry:checked_in", "Water:missed", "Walk:paused",
    ]);
  });

  it("counts that day's check-ins, including ones waiting for approval, not rejected ones", () => {
    const rows = dayDetail("2026-09-29", habits, perHabit, checkIns);
    expect(rows.find((r) => r.habitId === "laundry")).toMatchObject({ count: 2, pending: 1 });
    expect(rows.find((r) => r.habitId === "water")).toMatchObject({ count: 0 });
  });

  it("shows weekly and monthly habits only on days with a check-in", () => {
    expect(dayDetail("2026-09-28", habits, perHabit, checkIns).some((r) => r.habitId === "laundry")).toBe(false);
  });

  it("leaves out daily habits that hadn't started yet, and ones with no cell that day", () => {
    const early = [cells("read", [["2026-09-29", "not_started"]])];
    expect(dayDetail("2026-09-29", [habit("read", "day")], early, [])).toEqual([]);
    expect(dayDetail("2026-09-28", [habit("read", "day")], perHabit, [])).toEqual([]);
  });
});
