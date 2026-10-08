// ideas/templates-and-categories.md → "Kid templates" (flat list in M3), grouped since 2026-09-30.
export const KID_TEMPLATE_GROUPS = ["Morning & evening", "Healthy", "Helping at home", "Learning & play", "Kind & calm"] as const;
export type KidTemplateGroup = (typeof KID_TEMPLATE_GROUPS)[number];

// The first 12 keep their M3 order (the add-child defaults and tests rely on it).
export const KID_TEMPLATES = [
  { id: "brush-teeth", emoji: "🪥", title: "Brush teeth", targetCount: 2, period: "day", group: "Morning & evening" },
  { id: "read-together", emoji: "📖", title: "Read a book together", targetCount: 1, period: "day", group: "Learning & play" },
  { id: "tidy-toys", emoji: "🧸", title: "Tidy my toys", targetCount: 1, period: "day", group: "Helping at home" },
  { id: "bath", emoji: "🛁", title: "Bath time", targetCount: 1, period: "day", group: "Morning & evening" },
  { id: "veggies", emoji: "🥦", title: "Eat vegetables", targetCount: 1, period: "day", group: "Healthy" },
  { id: "bedtime", emoji: "😴", title: "Go to bed on time", targetCount: 1, period: "day", group: "Morning & evening" },
  { id: "dressed", emoji: "👕", title: "Get dressed by myself", targetCount: 1, period: "day", group: "Morning & evening" },
  { id: "wash-hands", emoji: "🧼", title: "Wash hands before eating", targetCount: 3, period: "day", group: "Healthy" },
  { id: "water", emoji: "💧", title: "Drink water", targetCount: 4, period: "day", group: "Healthy" },
  { id: "outside", emoji: "🌳", title: "Play outside", targetCount: 1, period: "day", group: "Healthy" },
  { id: "please-thanks", emoji: "💛", title: "Say please and thank you", targetCount: 1, period: "day", group: "Kind & calm" },
  { id: "chore", emoji: "🧺", title: "Help with a chore", targetCount: 1, period: "day", group: "Helping at home" },
  { id: "make-bed", emoji: "🛏️", title: "Make my bed", targetCount: 1, period: "day", group: "Morning & evening" },
  { id: "fruit", emoji: "🍎", title: "Eat a fruit", targetCount: 1, period: "day", group: "Healthy" },
  { id: "clear-plate", emoji: "🍽️", title: "Clear my plate", targetCount: 1, period: "day", group: "Helping at home" },
  { id: "laundry-basket", emoji: "🧦", title: "Clothes in the basket", targetCount: 1, period: "day", group: "Helping at home" },
  { id: "feed-pet", emoji: "🐶", title: "Feed the pet", targetCount: 1, period: "day", group: "Helping at home" },
  { id: "plants", emoji: "🌱", title: "Water the plants", targetCount: 2, period: "week", group: "Helping at home" },
  { id: "homework", emoji: "📝", title: "Do my homework", targetCount: 1, period: "day", group: "Learning & play" },
  { id: "school-bag", emoji: "🎒", title: "Pack my school bag", targetCount: 1, period: "day", group: "Learning & play" },
  { id: "music", emoji: "🎹", title: "Practice music", targetCount: 3, period: "week", group: "Learning & play" },
  { id: "sports", emoji: "⚽", title: "Sports practice", targetCount: 2, period: "week", group: "Learning & play" },
  { id: "draw", emoji: "🖍️", title: "Draw or color", targetCount: 1, period: "day", group: "Kind & calm" },
  { id: "screen-free", emoji: "📵", title: "A screen-free hour", targetCount: 1, period: "day", group: "Kind & calm" },
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
