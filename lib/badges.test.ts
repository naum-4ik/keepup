import { Moon, Sprout, Star } from "lucide-react";
import { describe, expect, it } from "vitest";
import { badgeGrid, badgeIcon, type CatalogRow } from "./badges";

const row = (code: string, group: string, sort: number, icon = "Sprout"): CatalogRow =>
  ({ code, name: code, description: `hint ${code}`, icon, badge_group: group, sort_order: sort });

describe("badgeGrid", () => {
  it("groups the catalog in the design's order, earned ones with their date", () => {
    const grid = badgeGrid(
      [row("rest_well", "comeback", 20, "Moon"), row("planted", "getting_started", 1), row("first_step", "getting_started", 2)],
      [{ achievement_code: "planted", unlocked_at: "2026-10-04T09:00:00Z" }],
    );
    expect(grid.map((g) => g.label)).toEqual(["Getting started", "Comeback"]);
    expect(grid[0].badges.map((b) => [b.code, b.earnedAt])).toEqual([["planted", "2026-10-04T09:00:00Z"], ["first_step", null]]);
    expect(grid[0].badges[1].hint).toBe("hint first_step");
    expect(grid[1].badges[0].icon).toBe(Moon);
  });
  it("an icon name the app doesn't know falls back to a star (fails soft)", () => {
    expect(badgeIcon("Sprout")).toBe(Sprout);
    expect(badgeIcon("SomethingNew")).toBe(Star);
  });
  it("a group the app doesn't know is left out rather than crashing", () => {
    expect(badgeGrid([row("x", "mystery", 1)], [])).toEqual([]);
  });
});
