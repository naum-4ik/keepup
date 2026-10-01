import { describe, expect, it } from "vitest";
import { GARDEN_STAGES, KID_THEMES, isKidTheme, lastWeek, newWeekLine, nextStep, restartDay, restartLine, stageFor, starsToNext, themeStages, stepLines } from "@/lib/garden";

describe("garden", () => {
  it("gives every stage its own picture and its own sky", () => {
    for (const t of KID_THEMES) {
      expect(new Set(t.stages.map((s) => s.icon)).size, t.id).toBe(5);
      expect(new Set(t.stages.map((s) => s.sky)).size, t.id).toBe(5);
      for (const s of t.stages) expect(s.sky, `${t.id} ${s.min}`).toMatch(/^from-\[#/);
    }
  });
  it("names this week's picture and the next one on the kid page", () => {
    expect(stepLines(7, "space")).toEqual({ now: "The moon 🌙", next: "5 more stars to planets 🪐" });
    expect(stepLines(2, "garden")).toEqual({ now: "A seed in the soil 🌰", next: "1 more star to a sprout 🌱" });
    expect(stepLines(18, "garden")).toEqual({ now: "A full garden 🌻", next: null });
    // Every line reads as plain English, in every theme.
    const lines = KID_THEMES.flatMap((t) => t.stages.slice(0, -1).map((s) => stepLines(s.min, t.id).next));
    expect(lines).toEqual([
      "3 more stars to a sprout 🌱",
      "4 more stars to the first flower 🌷",
      "5 more stars to flowers and a butterfly 🦋",
      "6 more stars to a full garden 🌻",
      "3 more stars to seaweed 🌿",
      "4 more stars to a fish 🐠",
      "5 more stars to fish and a shell 🐚",
      "6 more stars to a full reef 🐙",
      "3 more stars to a rocket 🚀",
      "4 more stars to the moon 🌙",
      "5 more stars to planets 🪐",
      "6 more stars to a starry galaxy 🌟",
      "3 more stars to a cracking egg 🐣",
      "4 more stars to a baby dino 🦎",
      "5 more stars to a dino and its nest 🦕",
      "6 more stars to a grown-up dino 🦖",
      "3 more stars to a house 🏠",
      "4 more stars to a house and a tree 🌳",
      "5 more stars to a street 🚗",
      "6 more stars to a little town 🏫",
    ]);
  });
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
  it("says which day the next one starts: the family's first day of the week", () => {
    expect(restartDay("2026-09-27")).toBe("Sunday"); // a Sunday-start week -> next Sunday
    expect(restartDay("2026-09-28")).toBe("Monday");
  });
  it("words the restart and the new week in the chosen theme", () => {
    expect(restartLine("garden", "Sunday", false)).toBe("A new garden starts on Sunday 🌱");
    expect(restartLine("garden", "Sunday", true)).toBe("Full garden! 🌻 A new one starts on Sunday");
    expect(restartLine("space", "Monday", false)).toBe("A new galaxy starts on Monday 🚀");
    expect(restartLine("aquarium", "Monday", true)).toBe("A full reef! 🐙 A new one starts on Monday");
    expect(newWeekLine("garden")).toBe("Last week's garden is in the album 📸 A new seed is planted 🌱");
    expect(newWeekLine("dino")).toBe("Last week's dino egg is in the album 📸 A new egg is waiting 🥚");
  });
  it("finds last week in the album (only if it had stars)", () => {
    const album = [{ week_start: "2026-09-20", stars: 9, stage: 2 }, { week_start: "2026-09-13", stars: 3, stage: 1 }];
    expect(lastWeek("2026-09-27", album)).toEqual(album[0]);
    expect(lastWeek("2026-10-04", album)).toBeNull();
    expect(lastWeek("2026-09-27", [{ week_start: "2026-09-20", stars: 0, stage: 0 }])).toBeNull();
  });
});

