import { habitErrorMessage } from "@/lib/habit-errors";

export type ReminderMode = "summary" | "time" | "off";

// habit_user_settings → what the habit page shows. No row = the defaults (reminders on, in the summary).
export function reminderMode(row: { reminders: boolean; remind_at: string | null } | null): { mode: ReminderMode; remindAt: string | null } {
  if (!row) return { mode: "summary", remindAt: null };
  if (!row.reminders) return { mode: "off", remindAt: null };
  return row.remind_at ? { mode: "time", remindAt: row.remind_at.slice(0, 5) } : { mode: "summary", remindAt: null };
}

export function reminderHint(s: { mode: ReminderMode; remindAt: string | null; reminderHour: number; muted: boolean }): string {
  if (s.muted) return "Muted: no reminders for this habit";
  if (s.mode === "off") return "No reminders";
  if (s.mode === "time" && s.remindAt) return `At ${s.remindAt}`;
  return `In your daily summary at ${String(s.reminderHour).padStart(2, "0")}:00`;
}

// The scheduler runs every 15 minutes, so the database only takes quarter-hour times (keepup:invalid_time).
export const QUARTER_HOURS: readonly string[] = Array.from({ length: 96 }, (_, i) =>
  `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);

const QUARTER_HOUR = /^([01]\d|2[0-3]):(00|15|30|45)$/;

// null = fine. Checked before the RPC so a bad time never reaches the database.
export function reminderError(mode: string, remindAt: string | null): string | null {
  if (mode !== "summary" && mode !== "time" && mode !== "off") return habitErrorMessage({ message: "keepup:invalid_choice" });
  if (mode === "time" && !QUARTER_HOUR.test(remindAt ?? "")) return habitErrorMessage({ message: "keepup:invalid_time" });
  return null;
}
