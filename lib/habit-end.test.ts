import { describe, expect, it } from "vitest";
import { tEn, tFor } from "@/lib/i18n/test-t";
import { END_PRESETS, endExample, endLabel, endOptions, endProgress, endsOnFor, extendEnd, hasEnded, noEndHint, presetLabel, withoutEnded } from "./habit-end";

describe("END_PRESETS", () => {
  it("offers days, weeks or months to match the habit's period", () => {
    expect(END_PRESETS.day).toEqual([7, 30, 60, 90]);
    expect(END_PRESETS.week).toEqual([4, 8, 12]);
    expect(END_PRESETS.month).toEqual([3, 6, 12]);
  });
});

describe("endsOnFor", () => {
  it("is the last day of the n-th period, counting the start", () => {
    expect(endsOnFor("2026-10-01", "day", 7)).toBe("2026-10-07");
    expect(presetLabel(tEn, 7, "day")).toBe("7 days");
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
    expect(endLabel(tEn, { n: 12, total: 30, almost: false }, "day")).toBe("Day 12 of 30");
    expect(endLabel(tEn, { n: 28, total: 30, almost: true }, "day")).toBe("Almost there · Day 28 of 30");
    expect(endLabel(tEn, { n: 3, total: 8, almost: false }, "week")).toBe("Week 3 of 8");
    expect(endLabel(tEn, { n: 2, total: 6, almost: false }, "month")).toBe("Month 2 of 6");
  });
});

describe("extendEnd", () => {
  it("adds the chosen length after the current end", () => {
    expect(extendEnd("2026-10-30", "day", 30)).toBe("2026-11-29");
    expect(extendEnd("2026-10-28", "week", 4)).toBe("2026-11-25");
    expect(extendEnd("2026-12-31", "month", 3)).toBe("2027-03-31");
  });
});

describe("endOptions", () => {
  it("offers the lengths that still end today or later, then +n after an end", () => {
    expect(endOptions(tEn, "2026-10-01", null, "2026-10-01", "day")?.map((o) => o.label)).toEqual(["7 days", "30 days", "60 days", "90 days"]);
    expect(endOptions(tEn, "2026-10-01", null, "2026-10-10", "day")?.map((o) => o.label)).toEqual(["30 days", "60 days", "90 days"]);
    expect(endOptions(tEn, "2026-10-01", "2026-10-07", "2026-10-03", "day")?.map((o) => [o.label, o.date])).toEqual([
      ["+7 days", "2026-10-14"],
      ["+30 days", "2026-11-06"],
      ["+60 days", "2026-12-06"],
      ["+90 days", "2027-01-05"],
    ]);
  });
  it("still offers them on the last day, and none once today is past the end", () => {
    expect(endOptions(tEn, "2026-10-01", "2026-10-07", "2026-10-07", "day")).not.toBeNull();
    expect(endOptions(tEn, "2026-10-01", "2026-10-07", "2026-10-08", "day")).toBeNull();
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

describe("noEndHint (no end yet)", () => {
  it("gives an example end and the count it would show from the start", () => {
    expect(noEndHint(tEn, "2026-10-19", "2026-10-19", "day")).toBe("Add an end, like 30 days, to see Day 1 of 30");
    expect(noEndHint(tEn, "2026-10-19", "2026-10-19", "week")).toBe("Add an end, like 8 weeks, to see Week 1 of 8");
    expect(noEndHint(tEn, "2026-10-19", "2026-10-19", "month")).toBe("Add an end, like 6 months, to see Month 1 of 6");
  });

  it("counts from the start for a habit already running, and from 1 before it starts", () => {
    expect(endExample("2026-10-09", "2026-10-19", "day")).toEqual({ n: 11, total: 30 });
    expect(endExample("2026-10-25", "2026-10-19", "week")).toEqual({ n: 1, total: 8 });
  });

  it("takes the next length the chips still offer once the example has passed, and says no end when none is left", () => {
    expect(endExample("2026-09-01", "2026-10-19", "day")).toEqual({ n: 49, total: 60 });
    expect(endExample("2026-01-01", "2026-10-19", "day")).toBeNull();
    expect(noEndHint(tEn, "2026-01-01", "2026-10-19", "day")).toBe("No end: it keeps going until you stop it.");
  });

  it("is written in ru and he with their plurals", () => {
    expect(noEndHint(tFor("ru"), "2026-10-19", "2026-10-19", "day")).toBe("Добавьте окончание, например 30 дней, чтобы видеть «День 1 из 30»");
    expect(noEndHint(tFor("ru"), "2026-10-19", "2026-10-19", "month")).toBe("Добавьте окончание, например 6 месяцев, чтобы видеть «Месяц 1 из 6»");
    expect(noEndHint(tFor("he"), "2026-10-19", "2026-10-19", "week")).toContain("8");
  });
});
