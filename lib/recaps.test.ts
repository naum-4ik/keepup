import { describe, expect, it } from "vitest";
import { tEn, tFor } from "@/lib/i18n/test-t";
import { heatLevel, heatmapDayTitle, parseRecap, recapLine, recapTitle, streakLabel } from "./recaps";

const week = { kind: "week", start: "2026-09-28", end: "2026-10-05", done: 10, possible: 11,
  longest: { title: "Read", emoji: "📚", length: 7, period: "day" }, top: [], badges: [], days: [] };

describe("recaps", () => {
  it("reads the database's recap and refuses anything else", () => {
    expect(parseRecap(week)?.done).toBe(10);
    expect(parseRecap({ kind: "year" })).toBeNull();
    expect(parseRecap(null)).toBeNull();
  });
  it("keeps which days were rest days", () => {
    const r = parseRecap({ ...week, days: [{ date: "2026-09-29", done: 0, possible: 0, rested: 1 }, { date: "2026-09-30", done: 1, possible: 1 }] })!;
    expect(r.days.map((d) => d.rested)).toEqual([1, 0]);
  });
  it("titles a week by its first day and a month by name", () => {
    expect(recapTitle(tEn, "en", parseRecap(week)!)).toBe("Week of 28 Sep");
    expect(recapTitle(tEn, "en", parseRecap({ ...week, kind: "month", start: "2026-09-01", end: "2026-10-01" })!)).toBe("September 2026");
  });
  it("week titles read as before in every month (day, then the fixed English abbreviation)", () => {
    const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    mon.forEach((m, i) => {
      const start = `2026-${String(i + 1).padStart(2, "0")}-0${(i % 9) + 1}`;
      expect(recapTitle(tEn, "en", parseRecap({ ...week, start })!)).toBe(`Week of ${(i % 9) + 1} ${m}`);
    });
  });
  it("uses the Inbox words, and stays gentle when nothing was due", () => {
    expect(recapLine(tEn, "en", parseRecap(week)!)).toBe("10 of 11 check-ins last week. Longest streak: \u2068Read\u2069 🔥 7 days");
    expect(recapLine(tEn, "en", parseRecap(week)!, "history")).toBe("10 of 11 check-ins. Longest streak: \u2068Read\u2069 🔥 7 days");
    expect(recapLine(tEn, "en", parseRecap({ ...week, longest: { title: "Gym", emoji: "", length: 1, period: "week" } })!)).toContain("\u2068Gym\u2069 🔥 1 week");
    expect(recapLine(tEn, "en", parseRecap({ ...week, kind: "month", start: "2026-09-01", longest: { title: "Gym", emoji: "", length: 3, period: "month" } })!, "history")).toContain("in September. Longest streak: \u2068Gym\u2069 🔥 3 months");
    expect(recapLine(tEn, "en", parseRecap({ ...week, done: 0, possible: 0, longest: null })!)).toBe("Nothing was due.");
  });
  it("never writes 0 of N", () => {
    expect(recapLine(tEn, "en", parseRecap({ ...week, done: 0, possible: 5, longest: null })!)).toBe("A quiet week.");
    expect(recapLine(tEn, "en", parseRecap({ ...week, kind: "month", start: "2026-09-01", done: 0, possible: 5, longest: null })!)).toBe("A quiet month.");
  });
  it("shades a day by how much of it got done, never red", () => {
    expect([heatLevel(0, 0), heatLevel(0, 3), heatLevel(1, 3), heatLevel(2, 3), heatLevel(3, 3)]).toEqual([0, 1, 2, 3, 4]);
  });
  it("names a streak with its unit", () => {
    expect(streakLabel(tEn, { title: "Gym", emoji: "🏋️", length: 1, period: "week" })).toBe("\u2068Gym\u2069 🔥 1 week");
  });
});

describe("heatmapDayTitle", () => {
  const day = { date: "2026-10-05", done: 2, possible: 3, rested: 0 };
  it("writes the day in words, not as an ISO date", () => {
    expect(heatmapDayTitle(tEn, "en", day)).toBe("Mon 5 Oct: 2 of 3");
    expect(heatmapDayTitle(tEn, "en", { ...day, rested: 1 })).toBe("Mon 5 Oct: 2 of 3, Rest day");
    expect(heatmapDayTitle(tEn, "en", { ...day, possible: 0, done: 0, rested: 1 })).toBe("Mon 5 Oct: Rest day");
    expect(heatmapDayTitle(tEn, "en", { ...day, possible: 0, done: 0 })).toBe("Mon 5 Oct: nothing due");
    expect(heatmapDayTitle(tEn, "en", undefined)).toBeUndefined();
  });
  it("in the viewer's language", () => {
    const ru = heatmapDayTitle(tFor("ru"), "ru", day)!;
    expect(ru).toMatch(/^пн 5 окт/);
    expect(ru).not.toContain("2026-10-05");
    expect(heatmapDayTitle(tFor("he"), "he", day)).not.toContain("2026-10-05");
  });
});
