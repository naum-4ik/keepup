import { describe, expect, it } from "vitest";
import { END_PRESETS, endLabel, endProgress, endsOnFor, extendEnd, hasEnded, withoutEnded } from "./habit-end";

describe("END_PRESETS", () => {
  it("offers days, weeks or months to match the habit's period", () => {
    expect(END_PRESETS.day).toEqual([30, 60, 90]);
    expect(END_PRESETS.week).toEqual([4, 8, 12]);
    expect(END_PRESETS.month).toEqual([3, 6, 12]);
  });
});

describe("endsOnFor", () => {
  it("is the last day of the n-th period, counting the start", () => {
    expect(endsOnFor("2026-10-01", "day", 30)).toBe("2026-10-30");
    expect(endsOnFor("2026-10-01", "week", 4)).toBe("2026-10-28");
    expect(endsOnFor("2026-10-01", "month", 3)).toBe("2026-12-31");
    expect(endsOnFor("2026-01-31", "month", 1)).toBe("2026-02-27"); // never past the next month's same day
  });
});

describe("endProgress", () => {
  it("counts Day n of N, and says Almost there in the last 3 days", () => {
    expect(endProgress("2026-10-01", "2026-10-30", "2026-10-12", "day")).toEqual({ n: 12, total: 30, almost: false });
    expect(endProgress("2026-10-01", "2026-10-30", "2026-10-28", "day")).toEqual({ n: 28, total: 30, almost: true });
  });
  it("counts weeks and months in their own unit; the last one is Almost there", () => {
    expect(endProgress("2026-10-01", "2026-10-28", "2026-10-15", "week")).toEqual({ n: 3, total: 4, almost: false });
    expect(endProgress("2026-10-01", "2026-10-28", "2026-10-22", "week")).toEqual({ n: 4, total: 4, almost: true });
    expect(endProgress("2026-10-01", "2026-12-31", "2026-11-05", "month")).toEqual({ n: 2, total: 3, almost: false });
  });
  it("is null before the start or after the end", () => {
    expect(endProgress("2026-10-05", "2026-10-30", "2026-10-01", "day")).toBeNull();
    expect(endProgress("2026-10-01", "2026-10-30", "2026-10-31", "day")).toBeNull();
  });
});

describe("endLabel", () => {
  it("reads naturally", () => {
    expect(endLabel({ n: 12, total: 30, almost: false }, "day")).toBe("Day 12 of 30");
    expect(endLabel({ n: 28, total: 30, almost: true }, "day")).toBe("Almost there · Day 28 of 30");
    expect(endLabel({ n: 3, total: 8, almost: false }, "week")).toBe("Week 3 of 8");
    expect(endLabel({ n: 2, total: 6, almost: false }, "month")).toBe("Month 2 of 6");
  });
});

describe("extendEnd", () => {
  it("adds the chosen length after the current end", () => {
    expect(extendEnd("2026-10-30", "day", 30)).toBe("2026-11-29");
    expect(extendEnd("2026-10-28", "week", 4)).toBe("2026-11-25");
    expect(extendEnd("2026-12-31", "month", 3)).toBe("2027-03-31");
  });
});

describe("hasEnded / withoutEnded", () => {
  it("has ended only after the last day, in the habit's own calendar", () => {
    expect(hasEnded("2026-10-03", "2026-10-03")).toBe(false);
    expect(hasEnded("2026-10-03", "2026-10-04")).toBe(true);
    expect(hasEnded(undefined, "2026-10-04")).toBe(false);
    expect(hasEnded(null, "2026-10-04")).toBe(false);
  });

  it("leaves ended habits out, each judged by its own today", () => {
    const habits = [{ habit_id: "a" }, { habit_id: "b" }, { habit_id: "c" }];
    const ends = new Map([
      ["a", "2026-10-03"],
      ["b", "2026-10-03"],
    ]);
    // "a" runs on a calendar that's already on the 4th; "b" on one still on the 3rd; "c" has no end.
    const today = { a: "2026-10-04", b: "2026-10-03", c: "2026-10-04" } as Record<string, string>;
    expect(withoutEnded(habits, ends, (h) => today[h.habit_id]).map((h) => h.habit_id)).toEqual(["b", "c"]);
  });
});
