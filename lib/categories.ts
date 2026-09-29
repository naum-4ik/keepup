import { BookOpen, BriefcaseBusiness, Footprints, HeartPulse, House, ShieldBan, Sun, Users, type LucideIcon } from "lucide-react";
import type { HabitCategory } from "@/lib/habit-schema";

export type CategoryMeta = { label: string; icon: LucideIcon; chipClass: string; iconClass: string; defaultEmoji: string };

// Pastel chip + deeper icon color. defaultEmoji matches private.default_emoji() in the database.
export const CATEGORIES: Record<HabitCategory, CategoryMeta> = {
  health: { label: "Health", icon: HeartPulse, chipClass: "bg-[#E3F1FA] dark:bg-[#3B82B8]/20", iconClass: "text-[#3B82B8]", defaultEmoji: "🍎" },
  fitness: { label: "Fitness", icon: Footprints, chipClass: "bg-[#E5F2E6] dark:bg-[#4F8A5B]/20", iconClass: "text-[#4F8A5B]", defaultEmoji: "👟" },
  mind: { label: "Mind", icon: Sun, chipClass: "bg-[#EEE8F8] dark:bg-[#7B61B0]/20", iconClass: "text-[#7B61B0]", defaultEmoji: "🌿" },
  learning: { label: "Learning", icon: BookOpen, chipClass: "bg-[#FBF3D9] dark:bg-[#B08A1E]/20", iconClass: "text-[#B08A1E]", defaultEmoji: "📚" },
  people: { label: "People", icon: Users, chipClass: "bg-[#FBE6E8] dark:bg-[#C2505F]/20", iconClass: "text-[#C2505F]", defaultEmoji: "💛" },
  home: { label: "Home", icon: House, chipClass: "bg-[#E0F3EF] dark:bg-[#3A8C7E]/20", iconClass: "text-[#3A8C7E]", defaultEmoji: "🏠" },
  work_money: { label: "Work & money", icon: BriefcaseBusiness, chipClass: "bg-[#F1EADF] dark:bg-[#8A6B45]/20", iconClass: "text-[#8A6B45]", defaultEmoji: "💼" },
  break_habit: { label: "Break a habit", icon: ShieldBan, chipClass: "bg-[#F0ECE8] dark:bg-[#8A7F76]/20", iconClass: "text-[#8A7F76]", defaultEmoji: "🚫" },
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
