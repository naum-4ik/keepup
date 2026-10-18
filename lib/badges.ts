import type { LucideIcon } from "lucide-react";
import { badgeIcon } from "@/lib/badge-icons";
import type { T } from "@/supabase/functions/_shared/i18n";

// One pastel per group, from the category colours (lib/categories.ts).
export const BADGE_GROUPS = [
  { key: "getting_started", chip: "bg-cat-health-soft", ink: "text-cat-health" },
  { key: "consistency", chip: "bg-cat-mind-soft", ink: "text-cat-mind" },
  { key: "categories", chip: "bg-cat-learning-soft", ink: "text-cat-learning" },
  { key: "comeback", chip: "bg-cat-people-soft", ink: "text-cat-people" },
  { key: "family", chip: "bg-cat-home-soft", ink: "text-cat-home" },
] as const;

export type CatalogRow = { code: string; name: string; description: string; icon: string; badge_group: string; sort_order: number };
export type EarnedRow = { achievement_code: string; unlocked_at: string };
export type Badge = { code: string; name: string; hint: string; icon: LucideIcon; earnedAt: string | null };
export type BadgeGroup = { key: string; label: string; chip: string; ink: string; badges: Badge[] };

// The codes the catalog has words for (badges.<code>.name|description). A code from a newer database
// isn't here yet: it shows the database's own text until the catalog catches up. A list, not
// Object.keys(en.badges): this module reaches client pages, and importing en.json would ship the whole
// English catalog in their scripts. lib/badges.test.ts keeps it equal to the catalog.
export const BADGE_CODES: ReadonlySet<string> = new Set([
  "all_together", "back_on_track", "bookworm", "calm_mind", "century", "cheerleader", "fair_judge", "first_step",
  "first_week", "free", "full_day", "go_getter", "good_company", "home_keeper", "hydrated", "mover",
  "perfect_week", "planted", "rest_well", "steady_month", "team_player", "two_weeks_strong", "unstoppable", "year_round",
]);

export function badgeText(t: T, code: string, fallback: { name: string; description: string }): { name: string; description: string } {
  return BADGE_CODES.has(code)
    ? { name: t(`badges.${code}.name`), description: t(`badges.${code}.description`) }
    : { name: fallback.name, description: fallback.description };
}

// A badge's name by code on every surface: the catalog's words when it has the code, else the database's.
export const badgeName = (t: T, code: string, fallback: string): string => (BADGE_CODES.has(code) ? t(`badges.${code}.name`) : fallback);

export function badgeGrid(t: T, catalog: CatalogRow[], earned: EarnedRow[]): BadgeGroup[] {
  const when = new Map(earned.map((e) => [e.achievement_code, e.unlocked_at]));
  return BADGE_GROUPS.map(({ key, chip, ink }) => ({
    key,
    chip,
    ink,
    label: t(`badgeGroups.${key}`),
    badges: catalog
      .filter((c) => c.badge_group === key)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => {
        const text = badgeText(t, c.code, c);
        return { code: c.code, name: text.name, hint: text.description, icon: badgeIcon(c.icon), earnedAt: when.get(c.code) ?? null };
      }),
  })).filter((g) => g.badges.length > 0);
}
