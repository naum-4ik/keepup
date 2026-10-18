import { BookOpen, BriefcaseBusiness, Footprints, HeartPulse, House, ShieldBan, Sun, Users, type LucideIcon } from "lucide-react";
import type { HabitCategory } from "@/lib/habit-schema";
import type { T } from "@/supabase/functions/_shared/i18n";

export type CategoryMeta = { icon: LucideIcon; chipClass: string; iconClass: string; defaultEmoji: string };

// Pastel chip + deeper icon color. defaultEmoji matches private.default_emoji() in the database.
export const CATEGORIES: Record<HabitCategory, CategoryMeta> = {
  health: { icon: HeartPulse, chipClass: "bg-cat-health-soft", iconClass: "text-cat-health", defaultEmoji: "🍎" },
  fitness: { icon: Footprints, chipClass: "bg-cat-fitness-soft", iconClass: "text-cat-fitness", defaultEmoji: "👟" },
  mind: { icon: Sun, chipClass: "bg-cat-mind-soft", iconClass: "text-cat-mind", defaultEmoji: "🌿" },
  learning: { icon: BookOpen, chipClass: "bg-cat-learning-soft", iconClass: "text-cat-learning", defaultEmoji: "📚" },
  people: { icon: Users, chipClass: "bg-cat-people-soft", iconClass: "text-cat-people", defaultEmoji: "💛" },
  home: { icon: House, chipClass: "bg-cat-home-soft", iconClass: "text-cat-home", defaultEmoji: "🏠" },
  work_money: { icon: BriefcaseBusiness, chipClass: "bg-cat-work-money-soft", iconClass: "text-cat-work-money", defaultEmoji: "💼" },
  break_habit: { icon: ShieldBan, chipClass: "bg-cat-break-habit-soft", iconClass: "text-cat-break-habit", defaultEmoji: "🚫" },
};

// The category's name in the reader's language (categories.<code>).
export const categoryLabel = (t: T, category: HabitCategory): string => t(`categories.${category}`);

export const CATEGORY_ORDER: HabitCategory[] = ["health", "fitness", "mind", "learning", "people", "home", "work_money", "break_habit"];

// App code can briefly run against a database that hasn't had the latest migration yet (Vercel
// previews, the minutes after a merge). A category the app doesn't know must not crash a page:
// the old `money` reads as Work & money, anything else as Health.
export function normalizeCategory(value: string): HabitCategory {
  if (Object.hasOwn(CATEGORIES, value)) return value as HabitCategory;
  return value === "money" ? "work_money" : "health";
}

// The habit's own emoji, or its category's default when it has none (also the pre-migration case).
export function habitEmoji(category: HabitCategory, emoji: string | null | undefined): string {
  return emoji?.trim() || CATEGORIES[category].defaultEmoji;
}
