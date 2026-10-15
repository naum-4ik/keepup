// lib/notification-categories.ts
// Spec: Mute controls. The words live in the catalog: `notificationCategories.<key>.label|hint`,
// `notificationSettings.pauseChoice.<choice>`, `notificationSettings.delivery.<delivery>`.
import type { T } from "@/supabase/functions/_shared/i18n";

export const NOTIFICATION_CATEGORIES = [
  { key: "reminders" },
  { key: "group_activity" },
  { key: "approvals" },
  { key: "nudges" },
  { key: "group_updates" },
  { key: "achievements" },
] as const;
export type CategoryKey = (typeof NOTIFICATION_CATEGORIES)[number]["key"];

// Shown under Approvals when it is set to Inbox only: no push, but the requests still arrive.
// (catalog: notificationCategories.approvalsOffNote)

export const PAUSE_CHOICES = [{ choice: "1h" }, { choice: "8h" }, { choice: "tomorrow" }, { choice: "until_on" }] as const;

// How each category arrives (owner, 2026-10-01). Silent is the default: no sound, no vibration.
// notification_prefs.delivery; the database checks it again (keepup:invalid_choice).
export const DELIVERIES = [
  { delivery: "sound" },
  { delivery: "silent" },
  { delivery: "inbox" },
] as const;
export type Delivery = (typeof DELIVERIES)[number]["delivery"];
export const DEFAULT_DELIVERY: Delivery = "silent";
// Achievements arrive in the Inbox only until the person chooses otherwise (owner, 2026-10-04). The
// database's private.push_allowed adopts the same default in the XP ledger migration (M5 PR 2);
// until then no achievements rows are written, so nothing is pushed.
export const defaultDelivery = (category: CategoryKey): Delivery => (category === "achievements" ? "inbox" : DEFAULT_DELIVERY);

const isCategory = (v: unknown): v is CategoryKey => NOTIFICATION_CATEGORIES.some((c) => c.key === v);
const isDelivery = (v: unknown): v is Delivery => DELIVERIES.some((d) => d.delivery === v);

// The validation whitelist for setDelivery: true if both are known.
export function validDelivery(category: unknown, delivery: unknown): boolean {
  return isCategory(category) && isDelivery(delivery);
}

// notification_prefs rows → every category's delivery. Missing or unknown → the category's default (fails soft).
export function deliveryByCategory(rows: readonly { category: string; delivery: string }[] | null): Record<CategoryKey, Delivery> {
  const out = Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c.key, defaultDelivery(c.key)])) as Record<CategoryKey, Delivery>;
  for (const r of rows ?? []) if (isCategory(r.category) && isDelivery(r.delivery)) out[r.category] = r.delivery;
  return out;
}


// Settings → Daily reminder. Without a device the hour can still be set (it is asked for before
// turning on), so its hint says when it starts to matter.
export const reminderHourHint = (t: T, hasDevice: boolean) =>
  t(hasDevice ? "notificationSettings.hourHintDevice" : "notificationSettings.hourHintNoDevice");

// The line under Daily reminder once this device is on. Pause all wins (nothing arrives anywhere),
// then Inbox only for Reminders (nothing arrives on the device). `pausedUntil`: "Mon 08:00", "you
// turn them back on", or null when not paused. `arrivesAt`: just turned on, say when the summary comes.
export function reminderStatus(t: T, o: { pausedUntil: string | null; delivery: Delivery; arrivesAt: string | null }): string {
  if (o.pausedUntil) return t("notificationSettings.status.paused", { until: o.pausedUntil });
  if (o.delivery === "inbox") return t("notificationSettings.status.inbox");
  return o.arrivesAt ? t("notificationSettings.status.onWithHour", { time: o.arrivesAt }) : t("notificationSettings.status.on");
}
