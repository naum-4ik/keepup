import { describe, expect, it } from "vitest";
import { GARDEN_STAGES, KID_THEMES, isKidTheme, lastWeek, newWeekLine, nextStep, restartDay, restartLine, stageFor, starsToNext, themeStages, sceneFor } from "@/lib/garden";

describe("garden", () => {
  it("never draws an empty scene: every theme has something standing at 0 stars", () => {
    for (const t of KID_THEMES) expect(sceneFor(0, t.id).plants.length, t.id).toBeGreaterThan(0);
    expect(sceneFor(0, "garden").plants).toEqual(["🌰"]);
    expect(sceneFor(0, "aquarium").plants).toEqual(["🐚"]);
  });
  it("shows a faint preview of the next picture, none once it's full", () => {
    expect(sceneFor(0, "garden").ghost).toBe("🌱");
    expect(sceneFor(4, "town").ghost).toBe("🌳");
    expect(sceneFor(18, "space").ghost).toBeNull();
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

