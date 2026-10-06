import { describe, expect, it } from "vitest";
import { celebrationQueue, isCelebrationMode, parseSeen } from "./celebrations";

describe("celebrationQueue", () => {
  it("one moment for the highest new level, then the badges, oldest first, at most three", () => {
    const q = celebrationQueue(
      [{ level: 2 }, { level: 3 }],
      [
        { code: "first_step", name: "First step", icon: "CircleCheck", unlockedAt: "2026-10-04T09:01:00Z" },
        { code: "planted", name: "Planted", icon: "Sprout", unlockedAt: "2026-10-04T09:00:00Z" },
        { code: "full_day", name: "Full day", icon: "CalendarCheck", unlockedAt: "2026-10-04T09:02:00Z" },
        { code: "first_week", name: "First week", icon: "Flame", unlockedAt: "2026-10-04T09:03:00Z" },
      ],
    );
    expect(q.map((c) => `${c.title}: ${c.line}`)).toEqual(["Level 3: Seedling 🌱", "Unlocked: Planted", "Unlocked: First step", "Unlocked: Full day"]);
  });
  it("nothing new, nothing shown", () => {
    expect(celebrationQueue([], [])).toEqual([]);
  });
});

describe("isCelebrationMode", () => {
  it("knows Full and Subtle only", () => {
    expect(isCelebrationMode("full")).toBe(true);
    expect(isCelebrationMode("subtle")).toBe(true);
    expect(isCelebrationMode("loud")).toBe(false);
  });
});

describe("parseSeen", () => {
  it("takes a level from 2 up or a badge code", () => {
    expect(parseSeen({ level: 3 })).toEqual({ level: 3 });
    expect(parseSeen({ badge: "first_step" })).toEqual({ badge: "first_step" });
  });
  it("refuses anything else", () => {
    for (const body of [null, {}, { level: 1 }, { level: 2.5 }, { level: "3" }, { badge: "DROP TABLE" }, { badge: "" }, "x"])
      expect(parseSeen(body)).toBeNull();
  });
});
