// No photos for anyone (design doc): an emoji from this curated set on a pastel circle.
export const AVATAR_EMOJI = [
  "🐼", "🦊", "🐨", "🐯", "🐸", "🐵", "🐰", "🐻", "🐱", "🐶", "🦁", "🐧",
  "🐢", "🦉", "🐙", "🦄", "🐝", "🦋", "🌻", "🌈", "⭐", "🍓", "🚀", "🎈",
] as const;

// Groups get a few group-ish emoji first, then the people set.
export const GROUP_AVATAR_EMOJI = ["🏡", "🍕", "⚽", "🎉", "🌳", "🎵", ...AVATAR_EMOJI] as const;

export type AvatarColor = "peach" | "sage" | "sky" | "lilac" | "butter" | "rose";

// Same pastels as the category chips (docs/design.md).
export const AVATAR_COLORS: Record<AvatarColor, string> = {
  peach: "bg-flame-soft",
  sage: "bg-cat-fitness-soft",
  sky: "bg-cat-health-soft",
  lilac: "bg-cat-mind-soft",
  butter: "bg-cat-learning-soft",
  rose: "bg-cat-people-soft",
};

export const AVATAR_COLOR_LABEL: Record<AvatarColor, string> = {
  peach: "Peach",
  sage: "Sage",
  sky: "Sky",
  lilac: "Lilac",
  butter: "Butter",
  rose: "Rose",
};

export const isAvatarColor = (v: string): v is AvatarColor => Object.hasOwn(AVATAR_COLORS, v);
export const isAvatarEmoji = (v: string): boolean => (AVATAR_EMOJI as readonly string[]).includes(v);
export const isGroupAvatarEmoji = (v: string): boolean => (GROUP_AVATAR_EMOJI as readonly string[]).includes(v);

// The state of an avatar form (your own, or a group's).
export type AvatarFormState = { status: "idle" } | { status: "saved" } | { status: "error"; message: string };

export function initialOf(name: string): string {
  return [...name.trim()][0]?.toUpperCase() ?? "?";
}

// The database only checks the shape; the curated set is the app's rule (docs/design.md).
export function parseAvatar(
  formData: FormData,
  isAllowedEmoji: (v: string) => boolean,
): { ok: true; emoji: string | null; color: AvatarColor } | { ok: false; message: string } {
  const emoji = String(formData.get("avatarEmoji") ?? "");
  const color = String(formData.get("avatarColor") ?? "");
  if (emoji !== "" && !isAllowedEmoji(emoji)) return { ok: false, message: "Pick one of these avatars." };
  if (!isAvatarColor(color)) return { ok: false, message: "Pick a color." };
  return { ok: true, emoji: emoji || null, color };
}
