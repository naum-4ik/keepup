import { BookOpen, Droplet, Footprints, Heart, House, ShieldBan, Sun, Wallet, type LucideIcon } from "lucide-react";
import type { HabitCategory } from "@/lib/habit-schema";

export type CategoryMeta = { label: string; icon: LucideIcon; chipClass: string; iconClass: string };

// From ~/Projects/keepup-notes/templates-and-categories.md (pastel chip + deeper icon color).
export const CATEGORIES: Record<HabitCategory, CategoryMeta> = {
  health: { label: "Health", icon: Droplet, chipClass: "bg-[#E3F1FA] dark:bg-[#3B82B8]/20", iconClass: "text-[#3B82B8]" },
  fitness: { label: "Fitness", icon: Footprints, chipClass: "bg-[#E5F2E6] dark:bg-[#4F8A5B]/20", iconClass: "text-[#4F8A5B]" },
  mind: { label: "Mind", icon: Sun, chipClass: "bg-[#EEE8F8] dark:bg-[#7B61B0]/20", iconClass: "text-[#7B61B0]" },
  learning: { label: "Learning", icon: BookOpen, chipClass: "bg-[#FBF3D9] dark:bg-[#B08A1E]/20", iconClass: "text-[#B08A1E]" },
  people: { label: "People", icon: Heart, chipClass: "bg-[#FBE6E8] dark:bg-[#C2505F]/20", iconClass: "text-[#C2505F]" },
  home: { label: "Home", icon: House, chipClass: "bg-[#E0F3EF] dark:bg-[#3A8C7E]/20", iconClass: "text-[#3A8C7E]" },
  money: { label: "Money", icon: Wallet, chipClass: "bg-[#F1EADF] dark:bg-[#8A6B45]/20", iconClass: "text-[#8A6B45]" },
  break_habit: { label: "Break a habit", icon: ShieldBan, chipClass: "bg-[#F0ECE8] dark:bg-[#8A7F76]/20", iconClass: "text-[#8A7F76]" },
};

export const CATEGORY_ORDER: HabitCategory[] = ["health", "fitness", "mind", "learning", "people", "home", "money", "break_habit"];
