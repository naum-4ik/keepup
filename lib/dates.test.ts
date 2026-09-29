import { describe, expect, it } from "vitest";
import { addDays, addMonths, formatLocalDate, formatMonth, monthGrid, nextWeekStart, todayIn } from "./dates";

describe("dates", () => {
  it("gives today's local date in a time zone", () => {
    const at = new Date("2026-06-30T22:30:00Z");
    expect(todayIn("Europe/Rome", at)).toBe("2026-07-01");
    expect(todayIn("America/New_York", at)).toBe("2026-06-30");
  });

  it("adds days across month ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("formats a local date without shifting it", () => {
    expect(formatLocalDate("2026-10-05")).toBe("Mon 5 Oct");
  });
});

describe("calendar helpers", () => {
  it("nextWeekStart is strictly after the day", () => {
    expect(nextWeekStart("2026-09-29", 1)).toBe("2026-10-05"); // Tue → next Mon
    expect(nextWeekStart("2026-10-05", 1)).toBe("2026-10-12"); // Mon → the Monday after
    expect(nextWeekStart("2026-09-29", 0)).toBe("2026-10-04"); // Tue → Sun
  });

  it("monthGrid pads to whole weeks from the week start", () => {
    const mon = monthGrid("2026-09", 1); // 1 Sep 2026 is a Tuesday
    expect(mon.slice(0, 2)).toEqual([null, "2026-09-01"]);
    expect(mon.length % 7).toBe(0);
    expect(mon.filter(Boolean)).toHaveLength(30);
    expect(monthGrid("2026-09", 0).slice(0, 3)).toEqual([null, null, "2026-09-01"]);
  });

  it("addMonths and formatMonth cross year ends", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(formatMonth("2026-09")).toBe("September 2026");
  });
});
