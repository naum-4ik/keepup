import { describe, expect, it } from "vitest";
import { tEn } from "@/lib/i18n/test-t";
import { DEFAULT_KID_TEMPLATE_IDS, KID_TEMPLATE_GROUPS, KID_TEMPLATES, kidTemplatesByGroup, kidTemplateTitle, kidTemplateTitlesIn, templatesLeft } from "@/lib/kid-templates";

describe("kid templates", () => {
  it("are 24, the toddler core still first, ids and titles unique", () => {
    expect(KID_TEMPLATES).toHaveLength(24);
    expect(KID_TEMPLATES.slice(0, 6).map((t) => t.emoji)).toEqual(["🪥", "📖", "🧸", "🛁", "🥦", "😴"]);
    expect(KID_TEMPLATES.find((t) => t.id === "brush-teeth")).toMatchObject({ targetCount: 2 });
    expect(kidTemplateTitle(tEn, "brush-teeth")).toBe("Brush teeth");
    expect(new Set(KID_TEMPLATES.map((t) => t.id)).size).toBe(24);
    expect(new Set(KID_TEMPLATES.map((t) => kidTemplateTitle(tEn, t.id))).size).toBe(24);
  });
  it("pre-selects brush teeth, read a book together and tidy my toys", () => {
    expect(DEFAULT_KID_TEMPLATE_IDS.map((id) => kidTemplateTitle(tEn, id)))
      .toEqual(["Brush teeth", "Read a book together", "Tidy my toys"]);
  });
  it("puts every template in one of the five groups, in group order", () => {
    const grouped = kidTemplatesByGroup(KID_TEMPLATES);
    expect(grouped.map((g) => g.group)).toEqual([...KID_TEMPLATE_GROUPS]);
    expect(grouped.flatMap((g) => g.templates)).toHaveLength(24);
    expect(grouped.every((g) => g.templates.length >= 2)).toBe(true);
  });
  it("drops empty groups (e.g. once a child has all of a group's habits)", () => {
    const some = KID_TEMPLATES.filter((t) => t.group === "healthy");
    expect(kidTemplatesByGroup(some).map((g) => g.group)).toEqual(["healthy"]);
  });
  it("collects each template's title from every catalog, once", () => {
    const titles = kidTemplateTitlesIn({
      en: { templates: { kid: { bath: "Bath time", water: "Drink water" } } },
      ru: { templates: { kid: { bath: "Купание", water: "Drink water" } } },
      he: {},
    });
    expect(titles).toEqual({ bath: ["Bath time", "Купание"], water: ["Drink water"] });
  });
  it("keeps a template hidden after the language changes", () => {
    const titles = { bath: ["Bath time", "Купание"], water: ["Drink water", "Пить воду"] };
    const tpls = [{ id: "bath" }, { id: "water" }, { id: "draw" }];
    // Added while the app was in Russian; now shown in English.
    const left = templatesLeft(tpls, titles, new Set(["Купание"]), (id) => ({ bath: "Bath time", water: "Drink water", draw: "Draw" })[id]!);
    expect(left.map((t) => t.id)).toEqual(["water", "draw"]);
    // And the current language alone still hides it.
    expect(templatesLeft(tpls, {}, new Set(["Bath time"]), (id) => ({ bath: "Bath time", water: "Drink water", draw: "Draw" })[id]!).map((t) => t.id)).toEqual(["water", "draw"]);
  });
});
