import { CATEGORIES } from "@/lib/categories";
import type { HabitCategory } from "@/lib/habit-schema";
import { cn } from "@/lib/utils";

export function CategoryIcon({ category, size = "md" }: { category: HabitCategory; size?: "sm" | "md" | "lg" }) {
  const meta = CATEGORIES[category];
  const Icon = meta.icon;
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center rounded-full", meta.chipClass, { sm: "size-9", md: "size-10", lg: "size-14" }[size])}
    >
      <Icon className={cn(meta.iconClass, { sm: "size-4.5", md: "size-5", lg: "size-7" }[size])} />
    </span>
  );
}
