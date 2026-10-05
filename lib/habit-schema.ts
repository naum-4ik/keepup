import { CATEGORIES } from "@/lib/categories";
import type { Database } from "@/lib/database.types";

export type HabitPeriod = Database["public"]["Enums"]["habit_period"];
export type HabitCategory = Database["public"]["Enums"]["habit_category"];

export const HABIT_PERIODS = ["day", "week", "month"] as const satisfies readonly HabitPeriod[];
export const HABIT_CATEGORIES = [
  "health", "fitness", "mind", "learning", "people", "home", "work_money", "break_habit",
] as const satisfies readonly HabitCategory[];
export const HABIT_TITLE_MAX = 60;
export const HABIT_EMOJI_MAX = 16; // code points, the database bound (habits_emoji_check)
export const TARGET_LIMITS: Record<HabitPeriod, number> = { day: 50, week: 7, month: 31 };

export type HabitFormValues = { title: string; emoji: string; category: string; targetCount: string; period: string; startsOn: string };
// startsOn omitted = today, decided by the database in the owner's time zone. The client never
// sends its own "today": it goes stale after local midnight and the insert would be refused.
export type HabitInput = { title: string; emoji: string; category: HabitCategory; targetCount: number; period: HabitPeriod; startsOn?: string };
export type HabitErrors = Partial<Record<keyof HabitInput, string>>;
export type HabitFormState =
  | { status: "idle" }
  | { status: "error"; errors?: HabitErrors; message?: string; values?: HabitFormValues };

export function readHabitForm(formData: FormData): HabitFormValues {
  return {
    title: String(formData.get("title") ?? ""),
    emoji: String(formData.get("emoji") ?? ""),
    category: String(formData.get("category") ?? ""),
    targetCount: String(formData.get("targetCount") ?? ""),
    period: String(formData.get("period") ?? ""),
    startsOn: String(formData.get("startsOn") ?? ""),
  };
}

function isCategory(value: string): value is HabitCategory {
  return (HABIT_CATEGORIES as readonly string[]).includes(value);
}

function isPeriod(value: string): value is HabitPeriod {
  return (HABIT_PERIODS as readonly string[]).includes(value);
}

function titleError(title: string): string | undefined {
  const length = [...title].length; // code points, like Postgres char_length
  if (length === 0) return "Enter a title.";
  if (length > HABIT_TITLE_MAX) return `Keep it to ${HABIT_TITLE_MAX} characters.`;
  return undefined;
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
// Starts with an emoji (a pictograph, a flag's two regional indicators, or a keycap like 1️⃣), then
// only emoji joiners/modifiers/pictographs, so "a⃣" or a lone "🇮" doesn't pass.
const EMOJI =
  /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3)(?:[\uFE0F\u200D\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}\u20E3]|\p{Extended_Pictographic})*$/u;

// Exactly one emoji: one grapheme (so 🧘‍♀️ or a flag counts as one) that is an emoji, not a letter.
export function isOneEmoji(value: string): boolean {
  return (
    [...segmenter.segment(value)].length === 1 && EMOJI.test(value) && [...value].length <= HABIT_EMOJI_MAX
  );
}

type Details = { title: string; emoji: string; category: HabitCategory };
type DetailErrors = Pick<HabitErrors, "title" | "emoji" | "category">;

// An empty emoji means "none picked": the category's default.
export function parseHabitDetails(values: { title: string; emoji: string; category: string }):
  | { ok: true; value: Details }
  | { ok: false; errors: DetailErrors } {
  const title = values.title.trim();
  const emoji = values.emoji.trim();
  const errors: DetailErrors = {};
  const tError = titleError(title);
  if (tError) errors.title = tError;
  if (emoji !== "" && !isOneEmoji(emoji)) errors.emoji = "Pick one emoji.";
  if (!isCategory(values.category)) errors.category = "Pick a category.";
  if (Object.keys(errors).length > 0 || !isCategory(values.category)) return { ok: false, errors };
  return { ok: true, value: { title, emoji: emoji || CATEGORIES[values.category].defaultEmoji, category: values.category } };
}

// Edit details. "" is None: a child's own habit with no category (kid templates) keeps none, with the
// kid star as its default emoji. Only the form for such a habit offers None, and the database refuses
// a null category on anyone else's habit.
export function parseDetailsEdit(values: { title: string; emoji: string; category: string }):
  | { ok: true; value: { title: string; emoji: string; category: HabitCategory | null } }
  | { ok: false; errors: DetailErrors } {
  if (values.category !== "") return parseHabitDetails(values);
  const parsed = parseHabitDetails({ ...values, emoji: values.emoji.trim() || "⭐", category: "home" });
  return parsed.ok ? { ok: true, value: { ...parsed.value, category: null } } : parsed;
}

export function parseHabit(values: HabitFormValues):
  | { ok: true; value: HabitInput }
  | { ok: false; errors: HabitErrors } {
  const details = parseHabitDetails(values);
  const errors: HabitErrors = details.ok ? {} : { ...details.errors };

  if (!isPeriod(values.period)) {
    errors.period = "Pick how often.";
  } else {
    const limit = TARGET_LIMITS[values.period];
    const count = Number(values.targetCount);
    // Digits only: Number() would also take "1e1" or "0x5".
    if (!/^\s*\d+\s*$/.test(values.targetCount) || count < 1 || count > limit) {
      errors.targetCount = `Pick 1–${limit} times a ${values.period}.`;
    }
  }

  // Empty means today. Format only; "not in the past / within a year" is enforced by the database
  // in the owner's time zone.
  if (values.startsOn !== "" && !LOCAL_DATE.test(values.startsOn)) errors.startsOn = "Pick a start date.";

  if (!details.ok || Object.keys(errors).length > 0 || !isPeriod(values.period)) return { ok: false, errors };
  return {
    ok: true,
    value: {
      ...details.value,
      targetCount: Number(values.targetCount),
      period: values.period,
      ...(values.startsOn ? { startsOn: values.startsOn } : {}),
    },
  };
}

export const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
