export const GROUP_KINDS = ["family", "friends", "couple", "roommates", "other"] as const;
export type GroupKind = (typeof GROUP_KINDS)[number];
export const GROUP_KIND_LABEL: Record<GroupKind, string> = {
  family: "Family",
  friends: "Friends",
  couple: "Couple",
  roommates: "Roommates",
  other: "Other",
};
// Invited users skip "Keepup is for…"; their purpose follows the group (ideas/onboarding.md).
export const purposeForGroupKind = (kind: GroupKind): "family" | "friends" =>
  kind === "family" || kind === "couple" ? "family" : "friends";

// Content emoji for the invite heading (owner-chosen copy, not UI icons).
export const GROUP_KIND_EMOJI: Record<GroupKind, string> = {
  family: "👨‍👩‍👧",
  couple: "💑",
  friends: "👯",
  roommates: "🏠",
  other: "👋",
};

export const isGroupKind = (v: string): v is GroupKind => (GROUP_KINDS as readonly string[]).includes(v);

export const GROUP_NAME_MAX = 40;

// Postgres counts characters (code points), so count the same way (see profile-schema).
export function parseGroupName(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.trim();
  if (value === "") return { ok: false, error: "Give the group a name." };
  if ([...value].length > GROUP_NAME_MAX) return { ok: false, error: `Keep it to ${GROUP_NAME_MAX} characters.` };
  return { ok: true, value };
}

export const inviteUrl = (origin: string, token: string) => `${origin}/invite/${token}`;

// Leaving or deleting a group deletes its children's profiles, so the confirm step names them.
export function childrenDeletionNotice(names: readonly string[]): string {
  if (names.length === 0) return "The children's profiles and history will be deleted.";
  if (names.length === 1) return `${names[0]}'s profile and history will be deleted.`;
  const list = `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `${list}'s profiles and history will be deleted.`;
}
