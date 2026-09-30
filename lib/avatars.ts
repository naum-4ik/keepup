// No photos for anyone (design doc): an emoji from this curated set on a pastel circle.
export const AVATAR_EMOJI = [
  "🐼", "🦊", "🐨", "🐯", "🐸", "🐵", "🐰", "🐻", "🐱", "🐶", "🦁", "🐧",
  "🐢", "🦉", "🐙", "🦄", "🐝", "🦋", "🌻", "🌈", "⭐", "🍓", "🚀", "🎈",
] as const;

export type AvatarColor = "peach" | "sage" | "sky" | "lilac" | "butter" | "rose";

// Same pastels as the category chips (docs/design.md).
export const AVATAR_COLORS: Record<AvatarColor, string> = {
  peach: "bg-[#FDE6D8] dark:bg-[#E8804F]/25",
  sage: "bg-[#E5F2E6] dark:bg-[#4F8A5B]/25",
  sky: "bg-[#E3F1FA] dark:bg-[#3B82B8]/25",
  lilac: "bg-[#EEE8F8] dark:bg-[#7B61B0]/25",
  butter: "bg-[#FBF3D9] dark:bg-[#B08A1E]/25",
  rose: "bg-[#FBE6E8] dark:bg-[#C2505F]/25",
};

export const isAvatarColor = (v: string): v is AvatarColor => Object.hasOwn(AVATAR_COLORS, v);
export const isAvatarEmoji = (v: string): boolean => (AVATAR_EMOJI as readonly string[]).includes(v);

export function initialOf(name: string): string {
  return [...name.trim()][0]?.toUpperCase() ?? "?";
}
