import { CATEGORIES } from "@/lib/categories";
import type { HabitCategory } from "@/lib/habit-schema";
import { cn } from "@/lib/utils";

export function CategoryIcon({ category, size = "md" }: { category: HabitCategory; size?: "md" | "lg" }) {
  const meta = CATEGORIES[category];
  const Icon = meta.icon;
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center rounded-full", meta.chipClass, size === "lg" ? "size-14" : "size-10")}
    >
      <Icon className={cn(meta.iconClass, size === "lg" ? "size-7" : "size-5")} />
    </span>
  );
}
