import { CATEGORIES, habitEmoji } from "@/lib/categories";
import type { HabitCategory } from "@/lib/habit-schema";
import { cn } from "@/lib/utils";

type Size = "xs" | "md" | "lg";
const CHIP: Record<Size, string> = { xs: "size-7", md: "size-10", lg: "size-14" };

// The category chip with its lucide icon: tabs and category pickers.
export function CategoryIcon({ category, size = "md" }: { category: HabitCategory; size?: Size }) {
  const meta = CATEGORIES[category];
  const Icon = meta.icon;
  return (
    <span aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-full", meta.chipClass, CHIP[size])}>
      <Icon className={cn(meta.iconClass, { xs: "size-4", md: "size-5", lg: "size-7" }[size])} />
    </span>
  );
}

// A habit: the same category-coloured chip with the habit's emoji in place of the icon, so the
// colour still tells the category and the emoji tells the habit. Falls back to the category default.
export function HabitEmoji({ category, emoji, size = "md" }: { category: HabitCategory; emoji?: string | null; size?: Size }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full leading-none select-none",
        CATEGORIES[category].chipClass,
        CHIP[size],
        { xs: "text-base", md: "text-xl", lg: "text-3xl" }[size],
      )}
    >
      {habitEmoji(category, emoji)}
    </span>
  );
}
