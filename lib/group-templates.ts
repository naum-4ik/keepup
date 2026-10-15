import type { GroupKind } from "@/lib/group-schema";
import type { HabitTemplate } from "@/lib/habit-templates";

// ideas/templates-and-categories.md → "Group templates (M3)".
export const GROUP_TEMPLATES: HabitTemplate[] = [
  { id: "g-family-dinner", emoji: "🍽️", category: "people", targetCount: 1, period: "week", popular: false },
  { id: "g-date-night", emoji: "🕯️", category: "people", targetCount: 1, period: "week", popular: false },
  { id: "g-family-walk", emoji: "🚶", category: "fitness", targetCount: 1, period: "week", popular: false },
  { id: "g-game-night", emoji: "🎲", category: "people", targetCount: 1, period: "week", popular: false },
  { id: "g-cook-together", emoji: "🍳", category: "home", targetCount: 1, period: "week", popular: false },
  { id: "g-tidy-together", emoji: "🧹", category: "home", targetCount: 1, period: "week", popular: false },
];

// "Date night (weekly, for a couple group)": the other kinds don't see it.
export const groupTemplatesFor = (kind: GroupKind): HabitTemplate[] =>
  GROUP_TEMPLATES.filter((t) => t.id !== "g-date-night" || kind === "couple");
