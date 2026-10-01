// lib/notification-categories.ts
// Spec: Mute controls. Achievements joins in M5, when there are any.
export const NOTIFICATION_CATEGORIES = [
  { key: "reminders", label: "Reminders", hint: "Your daily summary and habit reminders." },
  { key: "group_activity", label: "Group activity", hint: "Check-ins and “Everyone did it” in your groups." },
  { key: "approvals", label: "Approvals", hint: "Check-ins waiting for your OK." },
  { key: "nudges", label: "Nudges", hint: "When someone in your group thinks of you." },
  { key: "group_updates", label: "Group updates", hint: "New habits, pauses, new members and streaks." },
] as const;
export type CategoryKey = (typeof NOTIFICATION_CATEGORIES)[number]["key"];

export const APPROVALS_OFF_NOTE = "Your group can't complete habits that need your approval.";

export const PAUSE_CHOICES = [
  { choice: "1h", label: "1 hour" },
  { choice: "8h", label: "8 hours" },
  { choice: "tomorrow", label: "Until tomorrow" },
  { choice: "until_on", label: "Until I turn them back on" },
] as const;

// How each category arrives (owner, 2026-10-01). Silent is the default: no sound, no vibration.
// notification_prefs.delivery; the database checks it again (keepup:invalid_choice).
export const DELIVERIES = [
  { delivery: "sound", label: "Sound" },
  { delivery: "silent", label: "Silent" },
  { delivery: "inbox", label: "Inbox only" },
] as const;
export type Delivery = (typeof DELIVERIES)[number]["delivery"];
export const DEFAULT_DELIVERY: Delivery = "silent";

const isCategory = (v: unknown): v is CategoryKey => NOTIFICATION_CATEGORIES.some((c) => c.key === v);
const isDelivery = (v: unknown): v is Delivery => DELIVERIES.some((d) => d.delivery === v);

// The validation whitelist for setDelivery: true if both are known.
export function validDelivery(category: unknown, delivery: unknown): boolean {
  return isCategory(category) && isDelivery(delivery);
}

// notification_prefs rows → every category's delivery. Missing or unknown → Silent (fails soft).
export function deliveryByCategory(rows: readonly { category: string; delivery: string }[] | null): Record<CategoryKey, Delivery> {
  const out = Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c.key, DEFAULT_DELIVERY])) as Record<CategoryKey, Delivery>;
  for (const r of rows ?? []) if (isCategory(r.category) && isDelivery(r.delivery)) out[r.category] = r.delivery;
  return out;
}

export const IPHONE_SOUND_HINT = "On iPhone and iPad, sound is one switch for all of Keepup: Settings → Notifications → Keepup → Sounds.";
