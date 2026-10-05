// lib/levels.test.ts
import { describe, expect, it } from "vitest";
import { levelFor, levelLine, levelName, levelProgress, xpForLevel } from "./levels";

describe("levels (ideas/achievements-and-rewards.md §3)", () => {
  it("follows floor(sqrt(xp / 50)) + 1 at every boundary", () => {
    expect([0, 49, 50, 199, 200, 449, 450, 800, 1250].map(levelFor)).toEqual([1, 1, 2, 2, 3, 3, 4, 5, 6]);
  });
  it("never goes below level 1, even if undo takes XP under zero", () => {
    expect(levelFor(-10)).toBe(1);
  });
  it("knows where each level starts", () => {
    expect([1, 2, 3, 7].map(xpForLevel)).toEqual([0, 50, 200, 1800]);
  });
  it("names the growth path in groups of five", () => {
    expect([1, 5, 6, 10, 11, 15, 16, 20, 21, 40].map(levelName)).toEqual([
      "Seedling", "Seedling", "Sprout", "Sprout", "Sapling", "Sapling", "Tree", "Tree", "Forest", "Forest",
    ]);
  });
  it("measures the way to the next level", () => {
    expect(levelProgress(80)).toEqual({ level: 2, name: "Seedling", into: 30, span: 150, toNext: 120 });
    expect(levelProgress(0)).toEqual({ level: 1, name: "Seedling", into: 0, span: 50, toNext: 50 });
  });
});

describe("levelLine", () => {
  it("reads 'Level 7 · Sprout' and what's left to the next level", () => {
    expect(levelLine(1800)).toEqual({ title: "Level 7 · Sprout", toNext: "650 XP to Level 8" });
    expect(levelLine(0)).toEqual({ title: "Level 1 · Seedling", toNext: "50 XP to Level 2" });
  });
});
