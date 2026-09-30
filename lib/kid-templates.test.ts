import { describe, expect, it } from "vitest";
import { DEFAULT_KID_TEMPLATE_IDS, KID_TEMPLATE_GROUPS, KID_TEMPLATES, kidTemplatesByGroup } from "@/lib/kid-templates";

describe("kid templates", () => {
  it("are 24, the toddler core still first, ids and titles unique", () => {
    expect(KID_TEMPLATES).toHaveLength(24);
    expect(KID_TEMPLATES.slice(0, 6).map((t) => t.emoji)).toEqual(["🪥", "📖", "🧸", "🛁", "🥦", "😴"]);
    expect(KID_TEMPLATES.find((t) => t.id === "brush-teeth")).toMatchObject({ title: "Brush teeth", targetCount: 2 });
    expect(new Set(KID_TEMPLATES.map((t) => t.id)).size).toBe(24);
    expect(new Set(KID_TEMPLATES.map((t) => t.title)).size).toBe(24);
  });
  it("pre-selects brush teeth, read a book together and tidy my toys", () => {
    expect(DEFAULT_KID_TEMPLATE_IDS.map((id) => KID_TEMPLATES.find((t) => t.id === id)?.title))
      .toEqual(["Brush teeth", "Read a book together", "Tidy my toys"]);
  });
  it("puts every template in one of the five groups, in group order", () => {
    const grouped = kidTemplatesByGroup(KID_TEMPLATES);
    expect(grouped.map((g) => g.group)).toEqual([...KID_TEMPLATE_GROUPS]);
    expect(grouped.flatMap((g) => g.templates)).toHaveLength(24);
    expect(grouped.every((g) => g.templates.length >= 2)).toBe(true);
  });
  it("drops empty groups (e.g. once a child has all of a group's habits)", () => {
    const some = KID_TEMPLATES.filter((t) => t.group === "Healthy");
    expect(kidTemplatesByGroup(some).map((g) => g.group)).toEqual(["Healthy"]);
  });
});
