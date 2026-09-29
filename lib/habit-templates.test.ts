import { describe, expect, it } from "vitest";
import { HABIT_TEMPLATES } from "./habit-templates";
import { parseHabit } from "./habit-schema";

describe("HABIT_TEMPLATES", () => {
  it("has 39 templates, 6 popular, unique ids", () => {
    expect(HABIT_TEMPLATES).toHaveLength(39);
    expect(HABIT_TEMPLATES.filter((t) => t.popular)).toHaveLength(6);
    expect(new Set(HABIT_TEMPLATES.map((t) => t.id)).size).toBe(39);
  });

  it("no tab has more than 6 templates (the new-habit screen is a fixed 2×3 grid)", () => {
    const tabs = [HABIT_TEMPLATES.filter((t) => t.popular), ...Object.values(Object.groupBy(HABIT_TEMPLATES, (t) => t.category))];
    for (const list of tabs) expect(list?.length ?? 0).toBeLessThanOrEqual(6);
  });

  it("every template passes the habit rules", () => {
    for (const t of HABIT_TEMPLATES) {
      const r = parseHabit({ title: t.title, category: t.category, targetCount: String(t.targetCount), period: t.period, startsOn: "2026-10-05" });
      expect(r.ok, t.id).toBe(true);
    }
  });
});
