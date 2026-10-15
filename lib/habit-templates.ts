import { CATEGORIES } from "@/lib/categories";
import type { HabitCategory, HabitPeriod } from "@/lib/habit-schema";
import type { Purpose } from "@/lib/profile-schema";
import type { T } from "@/supabase/functions/_shared/i18n";

export type HabitTemplate = {
  id: string;
  emoji: string;
  category: HabitCategory;
  targetCount: number;
  period: HabitPeriod;
  popular: boolean;
};

const tpl = (id: string, emoji: string, category: HabitCategory, targetCount: number, period: HabitPeriod, popular = false): HabitTemplate =>
  ({ id, emoji, category, targetCount, period, popular });

// A habit or group template's title, in the reader's language (templates.<id>). It is the habit's
// title once created, so it is never translated afterwards.
export const templateTitle = (t: T, id: string): string => t(`templates.${id}`);

// Exactly 6 per category (the new-habit screen is a fixed 2×3 grid); anything else is "Create
// your own". The emoji and titles are mirrored in private.backfill_emoji() (habit emoji migration).
export const HABIT_TEMPLATES: HabitTemplate[] = [
  tpl("water", "💧", "health", 8, "day", true),
  tpl("sleep", "😴", "health", 1, "day", true),
  tpl("vitamins", "💊", "health", 1, "day"),
  tpl("veggies", "🥗", "health", 3, "day"),
  tpl("brush-teeth", "🪥", "health", 2, "day"),
  tpl("wake-up", "⏰", "health", 1, "day"),

  tpl("steps", "👟", "fitness", 1, "day", true),
  tpl("workout", "🏋️", "fitness", 3, "week", true),
  tpl("stretch", "🤸", "fitness", 1, "day"),
  tpl("run", "🏃", "fitness", 3, "week"),
  tpl("yoga", "🧘‍♀️", "fitness", 2, "week"),
  tpl("swim-cycle", "🏊", "fitness", 2, "week"),

  tpl("meditate", "🧘", "mind", 1, "day", true),
  tpl("journal", "📓", "mind", 1, "day"),
  tpl("gratitude", "✨", "mind", 1, "day"),
  tpl("no-phone-bed", "📵", "mind", 1, "day"),
  tpl("outside", "🌳", "mind", 1, "day"),
  tpl("pray", "🙏", "mind", 1, "day"),

  tpl("read", "📚", "learning", 1, "day", true),
  tpl("language", "🗣️", "learning", 1, "day"),
  tpl("instrument", "🎸", "learning", 3, "week"),
  tpl("podcast", "🎧", "learning", 3, "week"),
  tpl("study", "🎓", "learning", 5, "week"),
  tpl("write", "✍️", "learning", 3, "week"),

  tpl("call", "📞", "people", 1, "week"),
  tpl("message", "💌", "people", 2, "week"),
  tpl("kids-time", "🧸", "people", 1, "day"),
  tpl("date-night", "🕯️", "people", 1, "week"),
  tpl("kind", "🤝", "people", 1, "week"),
  tpl("screen-free-dinner", "🍽️", "people", 4, "week"),

  tpl("tidy", "🧹", "home", 1, "day"),
  tpl("bed", "🛏️", "home", 1, "day"),
  tpl("cook", "🍳", "home", 4, "week"),
  tpl("plants", "🪴", "home", 2, "week"),
  tpl("laundry", "🧺", "home", 2, "week"),
  tpl("kitchen", "🧽", "home", 1, "day"),

  tpl("plan-tomorrow", "📝", "work_money", 1, "day"),
  tpl("deep-work", "🎯", "work_money", 5, "week"),
  tpl("no-work-email", "🌙", "work_money", 1, "day"),
  tpl("no-spend", "💸", "work_money", 2, "week"),
  tpl("log-expenses", "🧾", "work_money", 1, "day"),
  tpl("budget-check", "📊", "work_money", 1, "week"),

  tpl("no-sugar", "🍬", "break_habit", 1, "day"),
  tpl("no-alcohol", "🍷", "break_habit", 1, "day"),
  tpl("no-social-morning", "📱", "break_habit", 1, "day"),
  tpl("no-smoking", "🚭", "break_habit", 1, "day"),
  tpl("no-snacking", "🍪", "break_habit", 1, "day"),
  tpl("no-caffeine", "☕", "break_habit", 1, "day"),
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
