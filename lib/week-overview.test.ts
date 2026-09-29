import { describe, expect, it } from "vitest";
import { comparisonLine, hasWeekData, ringDash, ringFraction, streakUnit } from "./week-overview";

const week = (done: number, possible: number, prev_done: number, prev_possible: number) => ({ done, possible, prev_done, prev_possible });

describe("comparisonLine", () => {
  it("counts how many more than last week", () => {
    expect(comparisonLine(week(18, 22, 15, 21))).toBe("3 more than last week");
    expect(comparisonLine(week(1, 1, 0, 3))).toBe("1 more than last week");
  });

  it("only compares with last week when there was one", () => {
    expect(comparisonLine(week(1, 1, 0, 0))).toBe("1 done this week");
  });

  it("calls it the best week yet when as much got done with fewer chances", () => {
    expect(comparisonLine(week(10, 10, 10, 14))).toBe("Your best week yet");
  });

  it("needs a last week to compare with before calling it the best", () => {
    expect(comparisonLine(week(0, 0, 0, 0))).toBe("A fresh start this week");
    expect(comparisonLine(week(5, 5, 5, 0))).toBe("5 done this week");
  });

  it("stays neutral otherwise, never negative", () => {
    expect(comparisonLine(week(4, 10, 12, 14))).toBe("4 done this week");
    expect(comparisonLine(week(0, 3, 9, 12))).toBe("A fresh start this week");
    expect(comparisonLine(week(6, 8, 6, 8))).toBe("6 done this week");
    expect(comparisonLine(week(6, 9, 6, 8))).toBe("6 done this week");
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
    expect(hasWeekData({ done: 0, possible: 0 })).toBe(false);
    expect(hasWeekData({ done: 0, possible: 2 })).toBe(true);
    expect(hasWeekData({ done: 1, possible: 1 })).toBe(true);
  });
});

describe("streakUnit", () => {
  it("names the streak in the habit's periods", () => {
    expect(streakUnit(12, "day")).toBe("days");
    expect(streakUnit(1, "week")).toBe("week");
    expect(streakUnit(3, "month")).toBe("months");
  });
});
