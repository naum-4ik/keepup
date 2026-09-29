export const DISPLAY_NAME_MAX = 40;

export const PURPOSES = ["me", "family", "friends"] as const;
export type Purpose = (typeof PURPOSES)[number];

// Fields both forms share; onboarding adds the purpose. The reminder hour returns to Settings with reminders (M4).
type BaseValues = { displayName: string; timezone: string; weekStart: string };
type BaseInput = { displayName: string; timezone: string; weekStart: 0 | 1 };

export type ProfileFormValues = BaseValues;
export type ProfileInput = BaseInput;
export type OnboardingFormValues = BaseValues & { purpose: string };
export type OnboardingInput = BaseInput & { purpose: Purpose | null };

export type ProfileErrors = Partial<Record<keyof ProfileInput | "purpose", string>>;
type FormState<V> =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; errors?: ProfileErrors; message?: string; values?: V };
export type ProfileFormState = FormState<ProfileFormValues>;
export type OnboardingFormState = FormState<OnboardingFormValues>;

type Parsed<T> = { ok: true; value: T } | { ok: false; errors: ProfileErrors };

export function readProfileForm(formData: FormData): ProfileFormValues {
  return readBase(formData);
}

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

function parseBase(values: BaseValues, timezones: ReadonlySet<string>, errors: ProfileErrors): BaseInput {
  const displayName = values.displayName.trim();
  const nameLength = [...displayName].length; // code points, like Postgres char_length

  if (nameLength === 0) errors.displayName = "Enter a name.";
  else if (nameLength > DISPLAY_NAME_MAX) errors.displayName = `Keep it to ${DISPLAY_NAME_MAX} characters.`;

  if (!timezones.has(values.timezone)) errors.timezone = "Pick a time zone from the list.";

  if (values.weekStart !== "0" && values.weekStart !== "1") errors.weekStart = "Pick Sunday or Monday.";

  return { displayName, timezone: values.timezone, weekStart: Number(values.weekStart) as 0 | 1 };
}

export function parseProfile(values: ProfileFormValues, timezones: ReadonlySet<string>): Parsed<ProfileInput> {
  const errors: ProfileErrors = {};
  const base = parseBase(values, timezones, errors);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: base };
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
  if (!purpose.ok) errors.purpose = "Pick one of the options, or none.";
  if (!purpose.ok || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { ...base, purpose: purpose.value } };
}
