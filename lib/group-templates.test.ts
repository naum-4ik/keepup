import { describe, expect, it } from "vitest";
import { GROUP_TEMPLATES } from "@/lib/group-templates";
import { HABIT_TEMPLATES } from "@/lib/habit-templates";

describe("group templates (the Together tab)", () => {
  it("has six, like every other category, with unique ids and titles", () => {
    expect(GROUP_TEMPLATES).toHaveLength(6);
    expect(new Set(GROUP_TEMPLATES.map((t) => t.id)).size).toBe(6);
    expect(new Set(GROUP_TEMPLATES.map((t) => t.title)).size).toBe(6);
  });
  it("doesn't clash with the private templates' ids", () => {
    const ids = new Set(HABIT_TEMPLATES.map((t) => t.id));
    expect(GROUP_TEMPLATES.every((t) => !ids.has(t.id))).toBe(true);
  });
});
