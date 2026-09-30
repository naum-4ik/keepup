import type { HabitTemplate } from "@/lib/habit-templates";

// ideas/templates-and-categories.md → "Group templates (M3)".
export const GROUP_TEMPLATES: HabitTemplate[] = [
  { id: "g-family-dinner", emoji: "🍽️", title: "Family dinner", category: "people", targetCount: 1, period: "week", popular: false },
  { id: "g-date-night", emoji: "🕯️", title: "Date night", category: "people", targetCount: 1, period: "week", popular: false },
  { id: "g-family-walk", emoji: "🚶", title: "Family walk", category: "fitness", targetCount: 1, period: "week", popular: false },
  { id: "g-game-night", emoji: "🎲", title: "Game night", category: "people", targetCount: 1, period: "week", popular: false },
];
