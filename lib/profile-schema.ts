export const DISPLAY_NAME_MAX = 40;

export type ProfileFormValues = { displayName: string; timezone: string; reminderHour: string };
export type ProfileInput = { displayName: string; timezone: string; reminderHour: number };
export type ProfileErrors = Partial<Record<keyof ProfileInput, string>>;
export type ProfileFormState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; errors?: ProfileErrors; message?: string; values?: ProfileFormValues };

export function readProfileForm(formData: FormData): ProfileFormValues {
  return {
    displayName: String(formData.get("displayName") ?? ""),
    timezone: String(formData.get("timezone") ?? ""),
    reminderHour: String(formData.get("reminderHour") ?? ""),
  };
}

export function parseProfile(
  values: ProfileFormValues,
  timezones: ReadonlySet<string>,
): { ok: true; value: ProfileInput } | { ok: false; errors: ProfileErrors } {
  const displayName = values.displayName.trim();
  const nameLength = [...displayName].length; // code points, like Postgres char_length
  const reminderHour = Number(values.reminderHour);
  const errors: ProfileErrors = {};

  if (nameLength === 0) errors.displayName = "Enter a name.";
  else if (nameLength > DISPLAY_NAME_MAX) errors.displayName = `Keep it to ${DISPLAY_NAME_MAX} characters.`;

  if (!timezones.has(values.timezone)) errors.timezone = "Pick a time zone from the list.";

  if (values.reminderHour === "" || !Number.isInteger(reminderHour) || reminderHour < 0 || reminderHour > 23) {
    errors.reminderHour = "Pick an hour between 00:00 and 23:00.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { displayName, timezone: values.timezone, reminderHour } };
}
