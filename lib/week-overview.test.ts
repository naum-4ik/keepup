import { describe, expect, it } from "vitest";
import { OUTCOME_LABEL, STATUS_WORD, comparisonLine, goalsMet, hasWeekData, ringDash, ringFraction, streakUnit, withTodayPending, type WeekOverview } from "./week-overview";

const week = (done: number, possible: number, prev_done: number, prev_possible: number) => ({ done, possible, prev_done, prev_possible });

describe("comparisonLine", () => {
  it("counts how many more than last week", () => {
    expect(comparisonLine(week(18, 22, 15, 21))).toBe("3 more than last week");
    expect(comparisonLine(week(1, 1, 0, 3))).toBe("1 more than last week");
  });

  it("only compares with last week when there was one", () => {
    expect(comparisonLine(week(1, 1, 0, 0))).toBeNull();
  });

  it("calls it the best week yet when as much got done with fewer chances", () => {
    expect(comparisonLine(week(10, 10, 10, 14))).toBe("Your best week yet");
  });

  it("needs a last week to compare with before calling it the best", () => {
    expect(comparisonLine(week(0, 0, 0, 0))).toBe("A fresh start this week");
    expect(comparisonLine(week(5, 5, 5, 0))).toBeNull();
  });

  it("stays neutral otherwise, never negative", () => {
    expect(comparisonLine(week(4, 10, 12, 14))).toBeNull();
    expect(comparisonLine(week(0, 3, 9, 12))).toBe("A fresh start this week");
    expect(comparisonLine(week(6, 8, 6, 8))).toBeNull();
    expect(comparisonLine(week(6, 9, 6, 8))).toBeNull();
  });
});

describe("goalsMet", () => {
  it("follows the total: goal for one, goals otherwise", () => {
    expect(goalsMet(1, 1)).toBe("1 of 1 goal met");
    expect(goalsMet(0, 1)).toBe("0 of 1 goal met");
    expect(goalsMet(2, 3)).toBe("2 of 3 goals met");
    expect(goalsMet(0, 0)).toBe("0 of 0 goals met");
  });
});

describe("ring maths", () => {
  it("fills done out of possible", () => {
    expect(ringFraction(18, 22)).toBeCloseTo(18 / 22);
    expect(ringFraction(0, 5)).toBe(0);
    expect(ringFraction(5, 5)).toBe(1);
  });

  it("is empty when nothing is possible and never overflows", () => {
    expect(ringFraction(0, 0)).toBe(0);
    expect(ringFraction(3, 0)).toBe(0);
    expect(ringFraction(7, 5)).toBe(1);
  });

  it("turns the share into a dash offset", () => {
    const full = ringDash(4, 4, 10);
    expect(full.circumference).toBeCloseTo(2 * Math.PI * 10);
    expect(full.offset).toBeCloseTo(0);
    expect(ringDash(1, 4, 10).offset).toBeCloseTo(full.circumference * 0.75);
    expect(ringDash(0, 0, 10).offset).toBeCloseTo(full.circumference);
  });
});

describe("hasWeekData", () => {
  it("is false only for a brand-new user", () => {
    expect(hasWeekData({ done: 0, possible: 0, active_habits: 0 })).toBe(false);
    expect(hasWeekData({ done: 0, possible: 0, active_habits: 3 })).toBe(true);
    expect(hasWeekData({ done: 0, possible: 2, active_habits: 0 })).toBe(true);
    expect(hasWeekData({ done: 1, possible: 1, active_habits: 0 })).toBe(true);
  });
});

describe("streakUnit", () => {
  it("names the streak in the habit's periods", () => {
    expect(streakUnit(12, "day")).toBe("days");
    expect(streakUnit(1, "week")).toBe("week");
    expect(streakUnit(3, "month")).toBe("months");
  });
});

describe("withTodayPending", () => {
  const base = {
    today: "2026-09-29", week_start: "2026-09-27", done: 2, possible: 2, prev_done: 0, prev_possible: 0,
    days: [{ local_date: "2026-09-29", daily_done: 1, daily_possible: 4 }],
    best_current_streak: 0, best_current_streak_title: null, best_current_streak_period: null,
    check_ins: 0, active_habits: 4, per_habit: [],
  } satisfies WeekOverview;

  it("adds today's daily habits still to do to possible, not to done", () => {
    expect(withTodayPending(base)).toMatchObject({ done: 2, possible: 5 });
  });

  it("changes nothing when today has no row", () => {
    expect(withTodayPending({ ...base, days: [] })).toMatchObject({ done: 2, possible: 2 });
  });
});

describe("rest days (M5)", () => {
  it("a rested period reads as a rest day, never as missed", () => {
    expect(STATUS_WORD.rested).toBe("rest day");
    expect(OUTCOME_LABEL.rested).toBe("Rest day");
    expect(OUTCOME_LABEL.missed).toBe("Missed");
  });
});
