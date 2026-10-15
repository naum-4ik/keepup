// app/(app)/profile/settings/notification-actions.ts
"use server";

import type { Attributes } from "@opentelemetry/api";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { errorCode, habitErrorMessage } from "@/lib/habit-errors";
import type { T } from "@/supabase/functions/_shared/i18n";
import { getT } from "@/lib/i18n/server";
import { track } from "@/lib/log";
import { validDelivery } from "@/lib/notification-categories";

// `code` is the database rule ("keepup:<code>"), so a caller can tell a refusal it can recover from.
export type NotifyResult = { ok: true } | { ok: false; message: string; code?: string };

// event: the product event to send (lib/log.ts track): INFO when it worked, WARN with the rule that refused it.
function result(t: T, error: { message: string; code?: string } | null, event?: { name: string; who: Attributes; fields?: Attributes }): NotifyResult {
  if (error) {
    const code = errorCode(error);
    if (event && code) track(event.name, event.who, { ...event.fields, "refusal.code": code }, "WARN");
    return { ok: false, message: habitErrorMessage(t, error), code };
  }
  if (event) track(event.name, event.who, event.fields);
  revalidatePath("/profile/settings");
  return { ok: true };
}

export async function setReminderHour(hour: number): Promise<NotifyResult> {
  const { t } = await getT();
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return { ok: false, message: "Pick an hour." };
  const { supabase, userId, who } = await requireUser();
  const { error } = await supabase.from("profiles").update({ reminder_hour: hour }).eq("id", userId);
  return result(t, error, { name: "reminder_set", who, fields: { "reminder.hour": hour } });
}

export async function setDelivery(category: string, delivery: string): Promise<NotifyResult> {
  const { t } = await getT();
  if (!validDelivery(category, delivery)) return { ok: false, message: habitErrorMessage(t, { message: "keepup:invalid_choice" }), code: "invalid_choice" };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("set_notification_delivery", { p_category: category, p_delivery: delivery });
  return result(t, error);
}

export async function pauseAll(choice: string): Promise<NotifyResult> {
  const { t } = await getT();
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("pause_notifications", { p_choice: String(choice) });
  return result(t, error);
}

export async function savePushSubscription(sub: { endpoint: string; p256dh: string; auth: string; userAgent: string }): Promise<NotifyResult> {
  const { t } = await getT();
  const { supabase, who } = await requireUser();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: String(sub.endpoint), p_p256dh: String(sub.p256dh), p_auth: String(sub.auth), p_user_agent: String(sub.userAgent).slice(0, 300),
  });
  return result(t, error, { name: "push_enabled", who });
}

export async function forgetPushSubscription(endpoint: string): Promise<NotifyResult> {
  const { t } = await getT();
  const { supabase, who } = await requireUser();
  const { error } = await supabase.rpc("delete_push_subscription", { p_endpoint: String(endpoint) });
  return result(t, error, { name: "push_disabled", who });
}
