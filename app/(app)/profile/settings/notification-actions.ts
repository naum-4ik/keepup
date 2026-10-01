// app/(app)/profile/settings/notification-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { errorCode, habitErrorMessage } from "@/lib/habit-errors";

// `code` is the database rule ("keepup:<code>"), so a caller can tell a refusal it can recover from.
export type NotifyResult = { ok: true } | { ok: false; message: string; code?: string };

function result(error: { message: string; code?: string } | null): NotifyResult {
  if (error) return { ok: false, message: habitErrorMessage(error), code: errorCode(error) };
  revalidatePath("/profile/settings");
  return { ok: true };
}

export async function setReminderHour(hour: number): Promise<NotifyResult> {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return { ok: false, message: "Pick an hour." };
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("profiles").update({ reminder_hour: hour }).eq("id", userId);
  return result(error);
}

export async function setCategory(category: string, enabled: boolean): Promise<NotifyResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("set_notification_pref", { p_category: String(category), p_enabled: enabled === true });
  return result(error);
}

export async function pauseAll(choice: string): Promise<NotifyResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("pause_notifications", { p_choice: String(choice) });
  return result(error);
}

export async function savePushSubscription(sub: { endpoint: string; p256dh: string; auth: string; userAgent: string }): Promise<NotifyResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: String(sub.endpoint), p_p256dh: String(sub.p256dh), p_auth: String(sub.auth), p_user_agent: String(sub.userAgent).slice(0, 300),
  });
  return result(error);
}

export async function forgetPushSubscription(endpoint: string): Promise<NotifyResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("delete_push_subscription", { p_endpoint: String(endpoint) });
  return result(error);
}

// On each app open, a device whose reminders are on saves its subscription again (once per load), so
// the 10-device cap drops a phone nobody uses, never an active one. Only an endpoint this account
// already has: a device removed under Devices stays removed. No revalidate: nothing on screen changes.
export async function refreshPushSubscription(sub: { endpoint: string; p256dh: string; auth: string; userAgent: string }): Promise<NotifyResult> {
  const { supabase } = await requireUser();
  const { data, error: readError } = await supabase.from("push_subscriptions").select("endpoint").eq("endpoint", String(sub.endpoint)).maybeSingle();
  if (readError || !data) return { ok: true };
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: String(sub.endpoint), p_p256dh: String(sub.p256dh), p_auth: String(sub.auth), p_user_agent: String(sub.userAgent).slice(0, 300),
  });
  return error ? { ok: false, message: habitErrorMessage(error), code: errorCode(error) } : { ok: true };
}
