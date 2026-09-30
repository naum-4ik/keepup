import { describe, expect, it } from "vitest";
import { nextStep, stageFor, starsToNext } from "@/lib/garden";

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
});

