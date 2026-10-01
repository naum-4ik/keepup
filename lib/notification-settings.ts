// lib/notification-settings.ts
import "server-only";
import { requireUser } from "@/lib/auth";
import { type CategoryKey, type Delivery, deliveryByCategory } from "@/lib/notification-categories";
import { deviceLabel } from "@/lib/push-support";

export type NotificationSettings = {
  reminderHour: number;
  mutedUntil: string | null;
  timezone: string;
  delivery: Record<CategoryKey, Delivery>;
  devices: { endpoint: string; label: string }[];
};

// Fails soft: during a deploy the app can run a moment before its migration (deploy order).
export async function getNotificationSettings(): Promise<NotificationSettings> {
  const { supabase, userId } = await requireUser();
  const [profile, prefs, subs] = await Promise.all([
    supabase.from("profiles").select("reminder_hour, muted_until, timezone").eq("id", userId).single(),
    supabase.from("notification_prefs").select("category, delivery"),
    supabase.from("push_subscriptions").select("endpoint, user_agent").order("created_at"),
  ]);
  for (const r of [profile, prefs, subs]) if (r.error) console.error("notification settings", r.error.message);
  return {
    reminderHour: profile.data?.reminder_hour ?? 20,
    mutedUntil: profile.data?.muted_until ?? null,
    timezone: profile.data?.timezone ?? "UTC",
    delivery: deliveryByCategory(prefs.data),
    devices: (subs.data ?? []).map((s) => ({ endpoint: s.endpoint, label: deviceLabel(s.user_agent) })),
  };
}
