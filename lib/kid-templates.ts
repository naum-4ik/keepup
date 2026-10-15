import type { T } from "@/supabase/functions/_shared/i18n";

// ideas/templates-and-categories.md → "Kid templates" (flat list in M3), grouped since 2026-09-30.
export const KID_TEMPLATE_GROUPS = ["morning-evening", "healthy", "helping", "learning-play", "kind-calm"] as const;
// Titles and group names come from the catalog: templates.kid.<id> and templates.kidGroup.<id>.
export const kidTemplateTitle = (t: T, id: string): string => t(`templates.kid.${id}`);
export const kidGroupLabel = (t: T, group: KidTemplateGroup): string => t(`templates.kidGroup.${group}`);
export type KidTemplateGroup = (typeof KID_TEMPLATE_GROUPS)[number];

// The first 12 keep their M3 order (the add-child defaults and tests rely on it).
export const KID_TEMPLATES = [
  { id: "brush-teeth", emoji: "🪥", targetCount: 2, period: "day", group: "morning-evening" },
  { id: "read-together", emoji: "📖", targetCount: 1, period: "day", group: "learning-play" },
  { id: "tidy-toys", emoji: "🧸", targetCount: 1, period: "day", group: "helping" },
  { id: "bath", emoji: "🛁", targetCount: 1, period: "day", group: "morning-evening" },
  { id: "veggies", emoji: "🥦", targetCount: 1, period: "day", group: "healthy" },
  { id: "bedtime", emoji: "😴", targetCount: 1, period: "day", group: "morning-evening" },
  { id: "dressed", emoji: "👕", targetCount: 1, period: "day", group: "morning-evening" },
  { id: "wash-hands", emoji: "🧼", targetCount: 3, period: "day", group: "healthy" },
  { id: "water", emoji: "💧", targetCount: 4, period: "day", group: "healthy" },
  { id: "outside", emoji: "🌳", targetCount: 1, period: "day", group: "healthy" },
  { id: "please-thanks", emoji: "💛", targetCount: 1, period: "day", group: "kind-calm" },
  { id: "chore", emoji: "🧺", targetCount: 1, period: "day", group: "helping" },
  { id: "make-bed", emoji: "🛏️", targetCount: 1, period: "day", group: "morning-evening" },
  { id: "fruit", emoji: "🍎", targetCount: 1, period: "day", group: "healthy" },
  { id: "clear-plate", emoji: "🍽️", targetCount: 1, period: "day", group: "helping" },
  { id: "laundry-basket", emoji: "🧦", targetCount: 1, period: "day", group: "helping" },
  { id: "feed-pet", emoji: "🐶", targetCount: 1, period: "day", group: "helping" },
  { id: "plants", emoji: "🌱", targetCount: 2, period: "week", group: "helping" },
  { id: "homework", emoji: "📝", targetCount: 1, period: "day", group: "learning-play" },
  { id: "school-bag", emoji: "🎒", targetCount: 1, period: "day", group: "learning-play" },
  { id: "music", emoji: "🎹", targetCount: 3, period: "week", group: "learning-play" },
  { id: "sports", emoji: "⚽", targetCount: 2, period: "week", group: "learning-play" },
  { id: "draw", emoji: "🖍️", targetCount: 1, period: "day", group: "kind-calm" },
  { id: "screen-free", emoji: "📵", targetCount: 1, period: "day", group: "kind-calm" },
] as const;

export type KidTemplate = (typeof KID_TEMPLATES)[number];
export type KidTemplateId = KidTemplate["id"];

export const DEFAULT_KID_TEMPLATE_IDS = ["brush-teeth", "read-together", "tidy-toys"] as const;

export const isKidTemplateId = (v: string): v is KidTemplateId => KID_TEMPLATES.some((t) => t.id === v);

// For lists with headings; groups with nothing left are dropped.
export function kidTemplatesByGroup(templates: readonly KidTemplate[]): { group: KidTemplateGroup; templates: KidTemplate[] }[] {
  return KID_TEMPLATE_GROUPS.map((group) => ({ group, templates: templates.filter((t) => t.group === group) })).filter(
    (g) => g.templates.length > 0,
  );
}
