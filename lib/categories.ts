import { BookOpen, BriefcaseBusiness, Footprints, HeartPulse, House, ShieldBan, Sun, Users, type LucideIcon } from "lucide-react";
import type { HabitCategory } from "@/lib/habit-schema";

export type CategoryMeta = { label: string; icon: LucideIcon; chipClass: string; iconClass: string; defaultEmoji: string };

// Pastel chip + deeper icon color. defaultEmoji matches private.default_emoji() in the database.
export const CATEGORIES: Record<HabitCategory, CategoryMeta> = {
  health: { label: "Health", icon: HeartPulse, chipClass: "bg-cat-health-soft", iconClass: "text-cat-health", defaultEmoji: "🍎" },
  fitness: { label: "Fitness", icon: Footprints, chipClass: "bg-cat-fitness-soft", iconClass: "text-cat-fitness", defaultEmoji: "👟" },
  mind: { label: "Mind", icon: Sun, chipClass: "bg-cat-mind-soft", iconClass: "text-cat-mind", defaultEmoji: "🌿" },
  learning: { label: "Learning", icon: BookOpen, chipClass: "bg-cat-learning-soft", iconClass: "text-cat-learning", defaultEmoji: "📚" },
  people: { label: "People", icon: Users, chipClass: "bg-cat-people-soft", iconClass: "text-cat-people", defaultEmoji: "💛" },
  home: { label: "Home", icon: House, chipClass: "bg-cat-home-soft", iconClass: "text-cat-home", defaultEmoji: "🏠" },
  work_money: { label: "Work & money", icon: BriefcaseBusiness, chipClass: "bg-cat-work-money-soft", iconClass: "text-cat-work-money", defaultEmoji: "💼" },
  break_habit: { label: "Break a habit", icon: ShieldBan, chipClass: "bg-cat-break-habit-soft", iconClass: "text-cat-break-habit", defaultEmoji: "🚫" },
};

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
