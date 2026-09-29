import type { Database } from "@/lib/database.types";

export type HabitPeriod = Database["public"]["Enums"]["habit_period"];
export type HabitCategory = Database["public"]["Enums"]["habit_category"];

export const HABIT_PERIODS = ["day", "week", "month"] as const satisfies readonly HabitPeriod[];
export const HABIT_CATEGORIES = [
  "health", "fitness", "mind", "learning", "people", "home", "money", "break_habit",
] as const satisfies readonly HabitCategory[];
export const HABIT_TITLE_MAX = 60;
export const TARGET_LIMITS: Record<HabitPeriod, number> = { day: 50, week: 7, month: 31 };

export type HabitFormValues = { title: string; category: string; targetCount: string; period: string; startsOn: string };
export type HabitInput = { title: string; category: HabitCategory; targetCount: number; period: HabitPeriod; startsOn: string };
export type HabitErrors = Partial<Record<keyof HabitInput, string>>;
export type HabitFormState =
  | { status: "idle" }
  | { status: "error"; errors?: HabitErrors; message?: string; values?: HabitFormValues };

export function readHabitForm(formData: FormData): HabitFormValues {
  return {
    title: String(formData.get("title") ?? ""),
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

export function parseHabitDetails(values: { title: string; category: string }):
  | { ok: true; value: { title: string; category: HabitCategory } }
  | { ok: false; errors: Pick<HabitErrors, "title" | "category"> } {
  const title = values.title.trim();
  const errors: Pick<HabitErrors, "title" | "category"> = {};
  const tError = titleError(title);
  if (tError) errors.title = tError;
  if (!isCategory(values.category)) errors.category = "Pick a category.";
  if (Object.keys(errors).length > 0 || !isCategory(values.category)) return { ok: false, errors };
  return { ok: true, value: { title, category: values.category } };
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
    if (values.targetCount === "" || !Number.isInteger(count) || count < 1 || count > limit) {
      errors.targetCount = `Pick 1–${limit} times a ${values.period}.`;
    }
  }

  // Format only; "not in the past / within a year" is enforced by the database in the owner's time zone.
  if (!LOCAL_DATE.test(values.startsOn)) errors.startsOn = "Pick a start date.";

  if (!details.ok || Object.keys(errors).length > 0 || !isPeriod(values.period)) return { ok: false, errors };
  return {
    ok: true,
    value: { ...details.value, targetCount: Number(values.targetCount), period: values.period, startsOn: values.startsOn },
  };
}

export const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
