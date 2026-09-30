import { describe, expect, it } from "vitest";
import { GARDEN_STAGES, KID_THEMES, isKidTheme, nextStep, stageFor, starsToNext, themeStages } from "@/lib/garden";

describe("garden", () => {
  it("grows at 0/3/7/12/18 stars (same as private.garden_stage)", () => {
    expect([0, 2, 3, 6, 7, 11, 12, 17, 18, 40].map(stageFor)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
  it("says how many stars to the next picture", () => {
    expect(starsToNext(0)).toBe(3);
    expect(starsToNext(8)).toBe(4);
    expect(starsToNext(18)).toBeNull();
  });
  it("describes the next step for the kid view: stars since this picture, stars it needs, and what comes", () => {
    expect(nextStep(0)).toEqual({ have: 0, need: 3, left: 3, icon: "🌱", label: "A sprout" });
    expect(nextStep(4)).toEqual({ have: 1, need: 4, left: 3, icon: "🌷", label: "The first flower" });
    expect(nextStep(11)).toEqual({ have: 4, need: 5, left: 1, icon: "🦋", label: "Flowers and a butterfly" });
    expect(nextStep(12)).toMatchObject({ have: 0, need: 6, icon: "🌻" });
    expect(nextStep(18)).toBeNull();
    expect(nextStep(30)).toBeNull();
  });
  it("has five themes, each with five stages at the same stars, the garden unchanged", () => {
    expect(KID_THEMES.map((t) => t.id)).toEqual(["garden", "aquarium", "space", "dino", "town"]);
    for (const t of KID_THEMES) {
      expect(t.stages).toHaveLength(5);
      expect(t.stages.map((s) => s.min)).toEqual([0, 3, 7, 12, 18]);
      expect(new Set(t.stages.map((s) => s.label)).size).toBe(5);
      expect(t.stages.every((s) => s.icon.length > 0)).toBe(true);
    }
    expect(themeStages("garden")).toBe(GARDEN_STAGES);
  });
  it("names the next picture in the chosen theme, and falls back to the garden", () => {
    expect(nextStep(4, "aquarium")).toMatchObject({ left: 3, icon: "🐠", label: "A fish" });
    expect(nextStep(4, "unknown")).toMatchObject({ icon: "🌷" });
    expect(isKidTheme("space")).toBe(true);
    expect(isKidTheme("jungle")).toBe(false);
  });
});

