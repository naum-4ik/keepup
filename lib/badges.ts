import {
  Bike, BookOpen, BriefcaseBusiness, CalendarCheck, CalendarDays, CalendarRange, CircleCheck, Droplet, Flame, Handshake, Heart, House,
  Leaf, Moon, Mountain, PartyPopper, RotateCcw, Scale, Shield, Sprout, Star, TreePine, Users, Zap, type LucideIcon,
} from "lucide-react";
import en from "@/supabase/functions/_shared/messages/en.json";
import type { T } from "@/supabase/functions/_shared/i18n";

// The 24 badges (ideas/achievements-and-rewards.md §4): lucide line icons in pastel circles, no tiers.
// achievements.icon holds the component name; an unknown one (a newer database) shows a star.
export const BADGE_ICONS: Record<string, LucideIcon> = {
  Bike, BookOpen, BriefcaseBusiness, CalendarCheck, CalendarDays, CalendarRange, CircleCheck, Droplet, Flame, Handshake, Heart, House,
  Leaf, Moon, Mountain, PartyPopper, RotateCcw, Scale, Shield, Sprout, Star, TreePine, Users, Zap,
};
export const badgeIcon = (icon: string): LucideIcon => BADGE_ICONS[icon] ?? Star;

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
// isn't here yet: it shows the database's own text until the catalog catches up.
export const BADGE_CODES: ReadonlySet<string> = new Set(Object.keys(en.badges));

export function badgeText(t: T, code: string, fallback: { name: string; description: string }): { name: string; description: string } {
  return BADGE_CODES.has(code)
    ? { name: t(`badges.${code}.name`), description: t(`badges.${code}.description`) }
    : { name: fallback.name, description: fallback.description };
}

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
