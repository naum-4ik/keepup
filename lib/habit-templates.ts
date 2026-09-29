import { CATEGORIES } from "@/lib/categories";
import type { HabitCategory, HabitPeriod } from "@/lib/habit-schema";
import type { Purpose } from "@/lib/profile-schema";

export type HabitTemplate = {
  id: string;
  emoji: string;
  title: string;
  category: HabitCategory;
  targetCount: number;
  period: HabitPeriod;
  popular: boolean;
};

const t = (id: string, emoji: string, title: string, category: HabitCategory, targetCount: number, period: HabitPeriod, popular = false): HabitTemplate =>
  ({ id, emoji, title, category, targetCount, period, popular });

// Exactly 6 per category (the new-habit screen is a fixed 2×3 grid); anything else is "Create
// your own". The emoji and titles are mirrored in private.backfill_emoji() (habit emoji migration).
export const HABIT_TEMPLATES: HabitTemplate[] = [
  t("water", "💧", "Drink water", "health", 8, "day", true),
  t("sleep", "😴", "Sleep by 23:00", "health", 1, "day", true),
  t("vitamins", "💊", "Take vitamins or meds", "health", 1, "day"),
  t("veggies", "🥗", "Eat fruit or vegetables", "health", 3, "day"),
  t("floss", "🦷", "Floss", "health", 1, "day"),
  t("wake-up", "⏰", "Wake up at 07:00", "health", 1, "day"),

  t("steps", "👟", "Walk 10,000 steps", "fitness", 1, "day", true),
  t("workout", "🏋️", "Work out", "fitness", 3, "week", true),
  t("stretch", "🤸", "Stretch", "fitness", 1, "day"),
  t("run", "🏃", "Run", "fitness", 3, "week"),
  t("yoga", "🧘‍♀️", "Yoga", "fitness", 2, "week"),
  t("swim-cycle", "🏊", "Swim or cycle", "fitness", 2, "week"),

  t("meditate", "🧘", "Meditate", "mind", 1, "day", true),
  t("journal", "📓", "Journal", "mind", 1, "day"),
  t("gratitude", "✨", "Gratitude: write 3 things", "mind", 1, "day"),
  t("no-phone-bed", "📵", "No phone in bed", "mind", 1, "day"),
  t("outside", "🌳", "Time outside", "mind", 1, "day"),
  t("pray", "🙏", "Pray", "mind", 1, "day"),

  t("read", "📚", "Read 20 min", "learning", 1, "day", true),
  t("language", "🗣️", "Learn a language", "learning", 1, "day"),
  t("instrument", "🎸", "Practice an instrument", "learning", 3, "week"),
  t("podcast", "🎧", "Podcast or course", "learning", 3, "week"),
  t("study", "🎓", "Study", "learning", 5, "week"),
  t("write", "✍️", "Write", "learning", 3, "week"),

  t("call", "📞", "Call family or a friend", "people", 1, "week"),
  t("message", "💌", "Message someone you miss", "people", 2, "week"),
  t("kids-time", "🧸", "Phone-free time with the kids", "people", 1, "day"),
  t("date-night", "🕯️", "Date night", "people", 1, "week"),
  t("kind", "🤝", "Do something kind", "people", 1, "week"),
  t("screen-free-dinner", "🍽️", "Screen-free dinner", "people", 4, "week"),

  t("tidy", "🧹", "Tidy up", "home", 1, "day"),
  t("bed", "🛏️", "Make the bed", "home", 1, "day"),
  t("cook", "🍳", "Cook at home", "home", 4, "week"),
  t("plants", "🪴", "Water the plants", "home", 2, "week"),
  t("laundry", "🧺", "Laundry", "home", 2, "week"),
  t("kitchen", "🧽", "Clean the kitchen", "home", 1, "day"),

  t("plan-tomorrow", "📝", "Plan tomorrow", "work_money", 1, "day"),
  t("deep-work", "🎯", "Deep-work block", "work_money", 5, "week"),
  t("no-work-email", "🌙", "No work email after 19:00", "work_money", 1, "day"),
  t("no-spend", "💸", "No-spend day", "work_money", 2, "week"),
  t("log-expenses", "🧾", "Log expenses", "work_money", 1, "day"),
  t("budget-check", "📊", "Weekly budget check", "work_money", 1, "week"),

  t("no-sugar", "🍬", "No sugar", "break_habit", 1, "day"),
  t("no-alcohol", "🍷", "No alcohol", "break_habit", 1, "day"),
  t("no-social-morning", "📱", "No social media before noon", "break_habit", 1, "day"),
  t("no-smoking", "🚭", "No smoking", "break_habit", 1, "day"),
  t("no-snacking", "🍪", "No snacking after dinner", "break_habit", 1, "day"),
  t("no-caffeine", "☕", "No caffeine after 14:00", "break_habit", 1, "day"),
];

export const MAX_STARTER_HABITS = 3;

// Onboarding step 2: the Popular templates; a family or friends purpose adds People and Home.
export function onboardingTemplates(purpose: Purpose | null): HabitTemplate[] {
  const shared = purpose === "family" || purpose === "friends";
  return [
    ...HABIT_TEMPLATES.filter((t) => t.popular),
    ...(shared ? HABIT_TEMPLATES.filter((t) => !t.popular && (t.category === "people" || t.category === "home")) : []),
  ];
}

// Beyond the category's own emoji, a general set, so a custom habit has something close at hand.
const EXTRA_EMOJI = [
  "⭐", "🌱", "💪", "🎨", "🐶", "✈️", "🧠", "❤️", "🎵", "🎯",
  "🚴", "🥤", "🌞", "🧩", "📷", "🎮", "🐱", "🌈", "💰", "🏆", "🍀", "🔥", "🙂", "🎉",
];
export const EMOJI_SUGGESTIONS_MAX = 30;

// The emoji picker's grid: the category default and its templates' emoji first, then the extras.
export function emojiSuggestions(category: HabitCategory): string[] {
  const own = HABIT_TEMPLATES.filter((t) => t.category === category).map((t) => t.emoji);
  return [...new Set([CATEGORIES[category].defaultEmoji, ...own, ...EXTRA_EMOJI])].slice(0, EMOJI_SUGGESTIONS_MAX);
}
