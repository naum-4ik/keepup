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
