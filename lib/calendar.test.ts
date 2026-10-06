import { describe, expect, it } from "vitest";
import { monthGrid, parseMonth, shiftMonth, summarizeDays } from "./calendar";

describe("monthGrid", () => {
  it("lays out a month in weeks from the week start, blanks outside the month", () => {
    const sun = monthGrid("2026-09", 0);
    expect(sun[0]).toEqual([null, null, "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05"]);
    expect(sun.at(-1)).toEqual(["2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", null, null, null]);
    const mon = monthGrid("2026-09", 1);
    expect(mon[0]).toEqual([null, "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06"]);
  });
});

describe("parseMonth / shiftMonth", () => {
  it("reads ?m=YYYY-MM and falls back to the current month", () => {
    expect(parseMonth("2026-08", "2026-09-30")).toBe("2026-08");
    expect(parseMonth("2026-13", "2026-09-30")).toBe("2026-09");
    expect(parseMonth(undefined, "2026-09-30")).toBe("2026-09");
    expect(parseMonth("2026-12", "2026-09-30")).toBe("2026-09"); // no future months
  });
  it("moves a month back and forward across years", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});

describe("summarizeDays", () => {
  const habits = [
    { habit_id: "read", title: "Read", emoji: null, category: "learning" as const, period: "day" as const, target_count: 1 },
    { habit_id: "walk", title: "Walk", emoji: null, category: "fitness" as const, period: "day" as const, target_count: 1 },
    { habit_id: "laundry", title: "Laundry", emoji: null, category: "home" as const, period: "week" as const, target_count: 2 },
  ];
  const cells = [
    { local_date: "2026-09-10", habit_id: "read", outcome: "done", check_ins: 1 },
    { local_date: "2026-09-10", habit_id: "walk", outcome: "missed", check_ins: 0 },
    { local_date: "2026-09-10", habit_id: "laundry", outcome: null, check_ins: 1 },
    { local_date: "2026-09-11", habit_id: "read", outcome: "skipped", check_ins: 0 },
  ];
  it("counts daily done of possible, and lists what was done first", () => {
    const d = summarizeDays(cells, habits).get("2026-09-10")!;
    expect(d).toMatchObject({ done: 1, possible: 2 });
    expect(d.rows.map((r) => `${r.title}:${r.status}`)).toEqual(["Read:done", "Laundry:checked_in", "Walk:missed"]);
  });
  it("counts today's open daily habits as possible, like the week strip", () => {
    const today = [
      { local_date: "2026-09-30", habit_id: "read", outcome: "done", check_ins: 1 },
      { local_date: "2026-09-30", habit_id: "walk", outcome: "open", check_ins: 0 },
    ];
    expect(summarizeDays(today, habits).get("2026-09-30")).toMatchObject({ done: 1, possible: 2 });
  });
  it("doesn't count a skipped day against you", () => {
    expect(summarizeDays(cells, habits).get("2026-09-11")).toMatchObject({ done: 0, possible: 0 });
  });
  it("lists a rest day as Rest day without counting it as possible", () => {
    const rest = [
      { local_date: "2026-09-13", habit_id: "read", outcome: "rested", check_ins: 0 },
      { local_date: "2026-09-13", habit_id: "walk", outcome: "done", check_ins: 1 },
    ];
    const d = summarizeDays(rest, habits).get("2026-09-13")!;
    expect(d).toMatchObject({ done: 1, possible: 1 });
    expect(d.rows.map((r) => `${r.title}:${r.status}`)).toEqual(["Walk:done", "Read:rested"]);
  });
  it("ignores habits it doesn't know", () => {
    expect(summarizeDays([{ local_date: "2026-09-12", habit_id: "gone", outcome: "done", check_ins: 1 }], habits).get("2026-09-12")).toBeUndefined();
  });
});
