import { describe, expect, it } from "vitest";
import { checkInState, describeProgress, describeSchedule, pauseEndQuickPicks } from "./schedule";

describe("describeSchedule", () => {
  it.each([
    [1, "day", "Daily"],
    [8, "day", "8× a day"],
    [1, "week", "Weekly"],
    [3, "week", "3× a week"],
    [1, "month", "Monthly"],
    [2, "month", "2× a month"],
  ] as const)("%i per %s → %s", (count, period, text) => {
    expect(describeSchedule(count, period)).toBe(text);
  });
});

describe("describeProgress", () => {
  const base = { targetCount: 1, period: "day" as const, doneCount: 0, daysLeft: 1, frozen: false, frozenUntil: null };

  it("daily once", () => {
    expect(describeProgress(base)).toEqual({ text: "Not done yet", atRisk: false });
    expect(describeProgress({ ...base, doneCount: 1 })).toEqual({ text: "Done for today", atRisk: false });
  });

  it("daily several times", () => {
    expect(describeProgress({ ...base, targetCount: 8, doneCount: 5 })).toEqual({ text: "5 / 8 today", atRisk: false });
    expect(describeProgress({ ...base, targetCount: 8, doneCount: 8 })).toEqual({ text: "Done for today", atRisk: false });
  });

  it("weekly with days left and at-risk", () => {
    const week = { ...base, period: "week" as const, targetCount: 3 };
    expect(describeProgress({ ...week, doneCount: 1, daysLeft: 4 })).toEqual({ text: "1 of 3 this week · 4 days left", atRisk: false });
    expect(describeProgress({ ...week, doneCount: 1, daysLeft: 2 })).toEqual({ text: "1 of 3 this week · 2 days left", atRisk: true });
    expect(describeProgress({ ...week, doneCount: 2, daysLeft: 1 })).toEqual({ text: "2 of 3 this week · 1 day left", atRisk: true });
    expect(describeProgress({ ...week, doneCount: 3, daysLeft: 3 })).toEqual({ text: "Done for this week", atRisk: false });
  });

  it("paused", () => {
    expect(describeProgress({ ...base, frozen: true, frozenUntil: "2026-10-08" })).toEqual({ text: "Paused until Thu 8 Oct", atRisk: false });
    expect(describeProgress({ ...base, frozen: true })).toEqual({ text: "Paused", atRisk: false });
  });

  it("not started yet", () => {
    expect(describeProgress({ ...base, notStarted: true, startsOn: "2026-10-12" })).toEqual({ text: "Starts Mon 12 Oct", atRisk: false });
  });
});

describe("pauseEndQuickPicks", () => {
  it("offers 1 week, 2 weeks and 1 month after the start date", () => {
    expect(pauseEndQuickPicks("2026-09-29")).toEqual([
      { label: "1 week", date: "2026-10-06" },
      { label: "2 weeks", date: "2026-10-13" },
      { label: "1 month", date: "2026-10-29" },
    ]);
  });

  it("carries the day of month across a shorter month", () => {
    // 31 Jan + 1 month: JS Date clamps day 31 in February by rolling into March.
    expect(pauseEndQuickPicks("2026-01-31")[2]).toEqual({ label: "1 month", date: "2026-03-03" });
  });
});

describe("checkInState", () => {
  const base = { targetCount: 1, period: "day" as const, doneCount: 0, checkedInToday: false, frozen: false };
  it("derives the button state", () => {
    expect(checkInState(base)).toBe("open");
    expect(checkInState({ ...base, frozen: true })).toBe("frozen");
    expect(checkInState({ ...base, notStarted: true, frozen: true })).toBe("not-started");
    expect(checkInState({ ...base, doneCount: 1 })).toBe("done");
    expect(checkInState({ ...base, targetCount: 8, doneCount: 3, checkedInToday: true })).toBe("open");
    expect(checkInState({ ...base, period: "week", targetCount: 3, doneCount: 1, checkedInToday: true })).toBe("checked-today");
  });
});
