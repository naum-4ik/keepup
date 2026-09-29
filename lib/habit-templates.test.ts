import { describe, expect, it } from "vitest";
import { HABIT_TEMPLATES } from "./habit-templates";
import { parseHabit } from "./habit-schema";

describe("HABIT_TEMPLATES", () => {
  it("has 39 templates, 14 popular, unique ids", () => {
    expect(HABIT_TEMPLATES).toHaveLength(39);
    expect(HABIT_TEMPLATES.filter((t) => t.popular)).toHaveLength(14);
    expect(new Set(HABIT_TEMPLATES.map((t) => t.id)).size).toBe(39);
  });

  it("every template passes the habit rules", () => {
    for (const t of HABIT_TEMPLATES) {
      const r = parseHabit({ title: t.title, category: t.category, targetCount: String(t.targetCount), period: t.period, startsOn: "2026-10-05" });
      expect(r.ok, t.id).toBe(true);
    }
  });
});
