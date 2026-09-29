import { describe, expect, it } from "vitest";
import { CATEGORIES, CATEGORY_ORDER, habitEmoji, normalizeCategory } from "./categories";

describe("CATEGORIES", () => {
  it("has Work & money in place of Money, and a default emoji per category", () => {
    expect(CATEGORY_ORDER).toEqual(["health", "fitness", "mind", "learning", "people", "home", "work_money", "break_habit"]);
    expect(CATEGORIES.work_money.label).toBe("Work & money");
    expect(CATEGORY_ORDER.map((c) => CATEGORIES[c].defaultEmoji)).toEqual(["🍎", "👟", "🌿", "📚", "💛", "🏠", "💼", "🚫"]);
  });
});

// The app can briefly read a database that hasn't had the emoji migration yet.
describe("normalizeCategory", () => {
  it("keeps known categories, reads the old money as Work & money, and anything else as Health", () => {
    expect(normalizeCategory("mind")).toBe("mind");
    expect(normalizeCategory("money")).toBe("work_money");
    expect(normalizeCategory("sport")).toBe("health");
    expect(normalizeCategory("toString")).toBe("health");
  });
});

describe("habitEmoji", () => {
  it("uses the habit's emoji, or the category default when it's missing or blank", () => {
    expect(habitEmoji("fitness", "🏊")).toBe("🏊");
    expect(habitEmoji("fitness", undefined)).toBe("👟");
    expect(habitEmoji("home", null)).toBe("🏠");
    expect(habitEmoji("work_money", " ")).toBe("💼");
  });
});
