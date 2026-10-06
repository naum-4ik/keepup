import { describe, expect, it } from "vitest";
import { heatLevel, parseRecap, recapLine, recapTitle, streakLabel } from "./recaps";

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
    expect(recapTitle(parseRecap(week)!)).toBe("Week of 28 Sep");
    expect(recapTitle(parseRecap({ ...week, kind: "month", start: "2026-09-01", end: "2026-10-01" })!)).toBe("September 2026");
  });
  it("uses the Inbox words, and stays gentle when nothing was due", () => {
    expect(recapLine(parseRecap(week)!)).toBe("10 of 11 check-ins last week. Longest streak: Read 🔥 7");
    expect(recapLine(parseRecap({ ...week, done: 0, possible: 0, longest: null })!)).toBe("Nothing was due.");
  });
  it("never writes 0 of N", () => {
    expect(recapLine(parseRecap({ ...week, done: 0, possible: 5, longest: null })!)).toBe("A quiet week.");
    expect(recapLine(parseRecap({ ...week, kind: "month", start: "2026-09-01", done: 0, possible: 5, longest: null })!)).toBe("A quiet month.");
  });
  it("shades a day by how much of it got done, never red", () => {
    expect([heatLevel(0, 0), heatLevel(0, 3), heatLevel(1, 3), heatLevel(2, 3), heatLevel(3, 3)]).toEqual([0, 1, 2, 3, 4]);
  });
  it("names a streak with its unit", () => {
    expect(streakLabel({ title: "Gym", emoji: "🏋️", length: 1, period: "week" })).toBe("Gym 🔥 1 week");
  });
});
