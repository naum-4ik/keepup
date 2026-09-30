import { describe, expect, it } from "vitest";
import { DEFAULT_KID_TEMPLATE_IDS, KID_TEMPLATES } from "@/lib/kid-templates";

describe("kid templates", () => {
  it("are the 12 from the notes, with the toddler core first", () => {
    expect(KID_TEMPLATES).toHaveLength(12);
    expect(KID_TEMPLATES.slice(0, 6).map((t) => t.emoji)).toEqual(["🪥", "📖", "🧸", "🛁", "🥦", "😴"]);
    expect(KID_TEMPLATES.find((t) => t.id === "brush-teeth")).toMatchObject({ title: "Brush teeth", targetCount: 2 });
  });
  it("pre-selects brush teeth, read a book together and tidy my toys", () => {
    expect(DEFAULT_KID_TEMPLATE_IDS.map((id) => KID_TEMPLATES.find((t) => t.id === id)?.title))
      .toEqual(["Brush teeth", "Read a book together", "Tidy my toys"]);
  });
});
