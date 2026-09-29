import type { HabitCategory, HabitPeriod } from "@/lib/habit-schema";

export type HabitTemplate = {
  id: string;
  title: string;
  category: HabitCategory;
  targetCount: number;
  period: HabitPeriod;
  popular: boolean;
};

const t = (id: string, title: string, category: HabitCategory, targetCount: number, period: HabitPeriod, popular = false): HabitTemplate =>
  ({ id, title, category, targetCount, period, popular });

export const HABIT_TEMPLATES: HabitTemplate[] = [
  t("water", "Drink water", "health", 8, "day", true),
  t("sleep", "Sleep by 23:00", "health", 1, "day", true),
  t("vitamins", "Take vitamins / medication", "health", 1, "day", true),
  t("veggies", "Eat fruit or vegetables", "health", 3, "day"),
  t("floss", "Floss", "health", 1, "day"),
  t("skincare", "Skincare routine", "health", 1, "day"),

  t("steps", "Walk 10,000 steps", "fitness", 1, "day", true),
  t("workout", "Work out", "fitness", 3, "week", true),
  t("stretch", "Stretch", "fitness", 1, "day", true),
  t("run", "Run", "fitness", 3, "week"),
  t("yoga", "Yoga", "fitness", 2, "week"),
  t("stairs", "Take the stairs", "fitness", 1, "day"),

  t("meditate", "Meditate", "mind", 1, "day", true),
  t("journal", "Journal", "mind", 1, "day", true),
  t("gratitude", "Gratitude: write 3 things", "mind", 1, "day"),
  t("no-phone-bed", "No phone in bed", "mind", 1, "day"),
  t("outside", "Time outside", "mind", 1, "day"),
  t("pray", "Pray", "mind", 1, "day"),

  t("read", "Read 20 min", "learning", 1, "day", true),
  t("language", "Learn a language", "learning", 1, "day", true),
  t("instrument", "Practice an instrument", "learning", 3, "week"),
  t("podcast", "Listen to a podcast or course", "learning", 3, "week"),
  t("study", "Study", "learning", 5, "week"),

  t("call", "Call family or a friend", "people", 1, "week", true),
  t("message", "Message someone you miss", "people", 2, "week"),
  t("kids-time", "Quality time with the kids (no phones)", "people", 1, "day"),
  t("date-night", "Date night", "people", 1, "week"),
  t("kind", "Do something kind", "people", 1, "week"),

  t("tidy", "Tidy up", "home", 1, "day", true),
  t("bed", "Make the bed", "home", 1, "day", true),
  t("cook", "Cook at home", "home", 4, "week"),
  t("plants", "Water the plants", "home", 2, "week"),
  t("laundry", "Laundry", "home", 2, "week"),
  t("kitchen", "Clean the kitchen", "home", 1, "day"),

  t("no-sugar", "No sugar", "break_habit", 1, "day", true),
  t("no-alcohol", "No alcohol", "break_habit", 1, "day"),
  t("no-social-morning", "No social media before noon", "break_habit", 1, "day"),
  t("no-smoking", "No smoking", "break_habit", 1, "day"),
  t("no-snacking", "No snacking after dinner", "break_habit", 1, "day"),
];
