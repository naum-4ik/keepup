import type { FieldError } from "@/lib/field-error";

export const DISPLAY_NAME_MAX = 40;

export const PURPOSES = ["me", "family", "friends"] as const;
export type Purpose = (typeof PURPOSES)[number];

// Fields onboarding and Settings share; onboarding adds the purpose. Settings saves each one on its own
// (parseProfileSetting).
type BaseValues = { displayName: string; timezone: string; weekStart: string };
type BaseInput = { displayName: string; timezone: string; weekStart: 0 | 1 };

export type ProfileInput = BaseInput;
export type OnboardingFormValues = BaseValues & { purpose: string };
export type OnboardingInput = BaseInput & { purpose: Purpose | null };

export type ProfileErrors = Partial<Record<keyof ProfileInput | "purpose", FieldError>>;
type FormState<V> =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; errors?: ProfileErrors; message?: string; values?: V };
export type OnboardingFormState = FormState<OnboardingFormValues>;

type Parsed<T> = { ok: true; value: T } | { ok: false; errors: ProfileErrors };

export function readOnboardingForm(formData: FormData): OnboardingFormValues {
  return { ...readBase(formData), purpose: String(formData.get("purpose") ?? "") };
}

function readBase(formData: FormData): BaseValues {
  return {
    displayName: String(formData.get("displayName") ?? ""),
    timezone: String(formData.get("timezone") ?? ""),
    weekStart: String(formData.get("weekStart") ?? ""),
  };
}

// One field each: the error for a bad value, or null.
function nameError(displayName: string): FieldError | null {
  const nameLength = [...displayName].length; // code points, like Postgres char_length
  if (nameLength === 0) return { key: "validation.nameRequired" };
  if (nameLength > DISPLAY_NAME_MAX) return { key: "validation.maxChars", values: { max: DISPLAY_NAME_MAX } };
  return null;
}
const timezoneError = (timezone: string, timezones: ReadonlySet<string>): FieldError | null => (timezones.has(timezone) ? null : { key: "validation.timezone" });
const weekStartError = (weekStart: string): FieldError | null => (weekStart === "0" || weekStart === "1" ? null : { key: "validation.weekStart" });

function parseBase(values: BaseValues, timezones: ReadonlySet<string>, errors: ProfileErrors): BaseInput {
  const displayName = values.displayName.trim();
  const name = nameError(displayName);
  if (name) errors.displayName = name;
  const timezone = timezoneError(values.timezone, timezones);
  if (timezone) errors.timezone = timezone;
  const weekStart = weekStartError(values.weekStart);
  if (weekStart) errors.weekStart = weekStart;
  return { displayName, timezone: values.timezone, weekStart: Number(values.weekStart) as 0 | 1 };
}

// Settings saves each setting on its own: one field, one column (profiles).
export const PROFILE_SETTINGS = ["displayName", "timezone", "weekStart"] as const;
export type ProfileSetting = (typeof PROFILE_SETTINGS)[number];
export type ProfileUpdate = { display_name: string } | { timezone: string } | { week_start: 0 | 1 };

export function parseProfileSetting(
  field: string,
  raw: string,
  timezones: ReadonlySet<string>,
): { ok: true; update: ProfileUpdate } | { ok: false; error: FieldError } {
  switch (field) {
    case "displayName": {
      const value = raw.trim();
      const error = nameError(value);
      return error ? { ok: false, error } : { ok: true, update: { display_name: value } };
    }
    case "timezone": {
      const error = timezoneError(raw, timezones);
      return error ? { ok: false, error } : { ok: true, update: { timezone: raw } };
    }
    case "weekStart": {
      const error = weekStartError(raw);
      return error ? { ok: false, error } : { ok: true, update: { week_start: Number(raw) as 0 | 1 } };
    }
    default:
      return { ok: false, error: { key: "errors.invalid_choice" } };
  }
}

// Empty means "not answered" (null); anything else must be one of the three answers.
export function parsePurpose(raw: string): { ok: true; value: Purpose | null } | { ok: false } {
  if (raw === "") return { ok: true, value: null };
  return (PURPOSES as readonly string[]).includes(raw) ? { ok: true, value: raw as Purpose } : { ok: false };
}

export function parseOnboarding(values: OnboardingFormValues, timezones: ReadonlySet<string>): Parsed<OnboardingInput> {
  const errors: ProfileErrors = {};
  const base = parseBase(values, timezones, errors);
  const purpose = parsePurpose(values.purpose);
  if (!purpose.ok) errors.purpose = { key: "validation.purpose" };
  if (!purpose.ok || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { ...base, purpose: purpose.value } };
}
