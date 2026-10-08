import "server-only";
import { requireUser } from "@/lib/auth";
import { reminderMode, type ReminderMode } from "@/lib/reminder-mode";
import { logError } from "@/lib/log";

export type HabitSettings = { muted: boolean; mode: ReminderMode; remindAt: string | null; hasDevice: boolean; reminderHour: number };

// Fails soft to the defaults (deploy order: the app may briefly run before its migration).
export async function getHabitSettings(habitId: string): Promise<HabitSettings> {
  const { supabase, userId } = await requireUser();
  const [row, devices, profile] = await Promise.all([
    supabase.from("habit_user_settings").select("muted, reminders, remind_at").eq("habit_id", habitId).eq("user_id", userId).maybeSingle(),
    supabase.from("push_subscriptions").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("reminder_hour").eq("id", userId).single(),
  ]);
  for (const r of [row, devices, profile]) if (r.error) logError("habit settings", r.error.message);
  return {
    muted: row.data?.muted ?? false,
    ...reminderMode(row.data ?? null),
    // any of the user's devices, not necessarily this one (brief)
    hasDevice: (devices.count ?? 0) > 0,
    reminderHour: profile.data?.reminder_hour ?? 20,
  };
}
