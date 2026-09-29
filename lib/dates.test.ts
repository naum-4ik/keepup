import { describe, expect, it } from "vitest";
import { addDays, formatLocalDate, todayIn } from "./dates";

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
