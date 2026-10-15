import { Moon, Sprout, Star } from "lucide-react";
import { describe, expect, it } from "vitest";
import { tEn } from "@/lib/i18n/test-t";
import { BADGE_CODES, badgeGrid, badgeIcon, badgeText, type CatalogRow } from "./badges";

const row = (code: string, group: string, sort: number, icon = "Sprout"): CatalogRow =>
  ({ code, name: code, description: `hint ${code}`, icon, badge_group: group, sort_order: sort });

describe("badgeGrid", () => {
  it("groups the catalog in the design's order, earned ones with their date", () => {
    const grid = badgeGrid(
      tEn,
      [row("rest_well", "comeback", 20, "Moon"), row("planted", "getting_started", 1), row("first_step", "getting_started", 2)],
      [{ achievement_code: "planted", unlocked_at: "2026-10-04T09:00:00Z" }],
    );
    expect(grid.map((g) => g.label)).toEqual(["Getting started", "Comeback"]);
    expect(grid[0].badges.map((b) => [b.code, b.earnedAt])).toEqual([["planted", "2026-10-04T09:00:00Z"], ["first_step", null]]);
    expect(grid[0].badges[1].hint).toBe("Check in for the first time."); // the catalog's words win over the row's
    expect(grid[1].badges[0].icon).toBe(Moon);
  });
  it("an icon name the app doesn't know falls back to a star (fails soft)", () => {
    expect(badgeIcon("Sprout")).toBe(Sprout);
    expect(badgeIcon("SomethingNew")).toBe(Star);
  });
  it("a group the app doesn't know is left out rather than crashing", () => {
    expect(badgeGrid(tEn, [row("x", "mystery", 1)], [])).toEqual([]);
  });
});

// What the database's achievements rows said when they were seeded (supabase/migrations/20261011100000_badges.sql).
const SEEDED: [string, string, string][] = [
  ["planted", "Planted", "Create your first habit."],
  ["first_step", "First step", "Check in for the first time."],
  ["full_day", "Full day", "Finish every habit due today, at least two."],
  ["first_week", "First week", "Keep any habit going 7 times in a row."],
  ["two_weeks_strong", "Two weeks strong", "14 days in a row."],
  ["unstoppable", "Unstoppable", "30 days in a row."],
  ["century", "Century", "100 days in a row."],
  ["year_round", "Year-round", "365 days in a row."],
  ["perfect_week", "Perfect week", "Every habit, every time, for a whole week. At least two habits."],
  ["steady_month", "Steady month", "Four weeks of a weekly habit in one month, or a monthly habit three months running."],
  ["hydrated", "Hydrated", "A Health habit of 8 or more a day, 7 days in a row."],
  ["mover", "Mover", "50 check-ins in Fitness."],
  ["calm_mind", "Calm mind", "30 times done in Mind."],
  ["bookworm", "Bookworm", "30 times done in Learning."],
  ["good_company", "Good company", "10 times done in People."],
  ["home_keeper", "Home keeper", "50 check-ins in Home."],
  ["go_getter", "Go-getter", "6 times done in Work & money."],
  ["free", "Free", "30 days in a row on a Break a habit habit."],
  ["back_on_track", "Back on track", "Build a 7 in a row again after a streak ended."],
  ["rest_well", "Rest well", "Use your first rest day."],
  ["all_together", "All together", "Your group's first \"Everyone did it\"."],
  ["team_player", "Team player", "10 group habits done together."],
  ["cheerleader", "Cheerleader", "Cheer 20 check-ins."],
  ["fair_judge", "Fair judge", "Approve 20 check-ins."],
];

describe("badgeText", () => {
  it("says the database's text for a code the catalog doesn't know yet", () => {
    expect(badgeText(tEn, "unknown_code", { name: "Go-getter", description: "Six times." })).toEqual({ name: "Go-getter", description: "Six times." });
  });
  it("says the catalog's text for a known code, the same English as the database's", () => {
    expect(badgeText(tEn, "go_getter", { name: "from the database", description: "from the database" })).toEqual({ name: "Go-getter", description: "6 times done in Work & money." });
  });
  it("has words for all 24 seeded badges, saying what the database says", () => {
    expect([...BADGE_CODES].sort()).toEqual(SEEDED.map(([code]) => code).sort());
    for (const [code, name, description] of SEEDED) expect(badgeText(tEn, code, { name: "x", description: "x" }), code).toEqual({ name, description });
  });
});
