import type { FieldError } from "@/lib/field-error";
import type { ReactNode } from "react";
import { listNodes, type Rich } from "@/lib/list-nodes";
import type { Locale, T } from "@/supabase/functions/_shared/i18n";

export const GROUP_KINDS = ["family", "friends", "couple", "roommates", "other"] as const;
export type GroupKind = (typeof GROUP_KINDS)[number];
export const groupKindLabel = (t: T, kind: GroupKind): string => t(`groups.kind.${kind}`);
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
export function parseGroupName(raw: string): { ok: true; value: string } | { ok: false; error: FieldError } {
  const value = raw.trim();
  if (value === "") return { ok: false, error: { key: "validation.groupName" } };
  if ([...value].length > GROUP_NAME_MAX) return { ok: false, error: { key: "validation.maxChars", values: { max: GROUP_NAME_MAX } } };
  return { ok: true, value };
}

export const inviteUrl = (origin: string, token: string) => `${origin}/invite/${token}`;

// Leaving or deleting a group deletes its children's profiles, so the confirm step names them.
// For visible JSX: each name sits in its own <bdi>.
export function childrenDeletionNotice(rich: Rich, locale: Locale, names: readonly string[]): ReactNode {
  return rich("groups.childrenDeletion", { n: names.length, names: listNodes(locale, names) });
}
