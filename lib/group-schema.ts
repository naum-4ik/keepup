export const GROUP_KINDS = ["family", "friends", "couple", "roommates", "other"] as const;
export type GroupKind = (typeof GROUP_KINDS)[number];
export const GROUP_KIND_LABEL: Record<GroupKind, string> = {
  family: "Family",
  friends: "Friends",
  couple: "Couple",
  roommates: "Roommates",
  other: "Other",
};
export const isGroupKind = (v: string): v is GroupKind => (GROUP_KINDS as readonly string[]).includes(v);

// Postgres counts characters (code points), so count the same way (see profile-schema).
export function parseGroupName(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.trim();
  if (value === "") return { ok: false, error: "Give the group a name." };
  if ([...value].length > 40) return { ok: false, error: "Keep it to 40 characters." };
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
