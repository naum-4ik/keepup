import {
  Bike, BookOpen, BriefcaseBusiness, CalendarCheck, CalendarDays, CalendarRange, CircleCheck, Droplet, Flame, Handshake, Heart, House,
  Leaf, Moon, Mountain, PartyPopper, RotateCcw, Scale, Shield, Sprout, Star, TreePine, Users, Zap, type LucideIcon,
} from "lucide-react";

// The 24 badges (ideas/achievements-and-rewards.md §4): lucide line icons in pastel circles, no tiers.
// achievements.icon holds the component name; an unknown one (a newer database) shows a star.
export const BADGE_ICONS: Record<string, LucideIcon> = {
  Bike, BookOpen, BriefcaseBusiness, CalendarCheck, CalendarDays, CalendarRange, CircleCheck, Droplet, Flame, Handshake, Heart, House,
  Leaf, Moon, Mountain, PartyPopper, RotateCcw, Scale, Shield, Sprout, Star, TreePine, Users, Zap,
};
export const badgeIcon = (icon: string): LucideIcon => BADGE_ICONS[icon] ?? Star;

// One pastel per group, from the category colours (lib/categories.ts).
export const BADGE_GROUPS = [
  { key: "getting_started", label: "Getting started", chip: "bg-cat-health-soft", ink: "text-cat-health" },
  { key: "consistency", label: "Consistency", chip: "bg-cat-mind-soft", ink: "text-cat-mind" },
  { key: "categories", label: "Categories", chip: "bg-cat-learning-soft", ink: "text-cat-learning" },
  { key: "comeback", label: "Comeback", chip: "bg-cat-people-soft", ink: "text-cat-people" },
  { key: "family", label: "Family", chip: "bg-cat-home-soft", ink: "text-cat-home" },
] as const;

export type CatalogRow = { code: string; name: string; description: string; icon: string; badge_group: string; sort_order: number };
export type EarnedRow = { achievement_code: string; unlocked_at: string };
export type Badge = { code: string; name: string; hint: string; icon: LucideIcon; earnedAt: string | null };
export type BadgeGroup = { key: string; label: string; chip: string; ink: string; badges: Badge[] };

export function badgeGrid(catalog: CatalogRow[], earned: EarnedRow[]): BadgeGroup[] {
  const when = new Map(earned.map((e) => [e.achievement_code, e.unlocked_at]));
  return BADGE_GROUPS.map((g) => ({
    ...g,
    badges: catalog
      .filter((c) => c.badge_group === g.key)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({ code: c.code, name: c.name, hint: c.description, icon: badgeIcon(c.icon), earnedAt: when.get(c.code) ?? null })),
  })).filter((g) => g.badges.length > 0);
}
