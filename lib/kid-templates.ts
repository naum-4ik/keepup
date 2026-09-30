// ideas/templates-and-categories.md → "Kid templates (M3; flat list, no categories)".
export const KID_TEMPLATES = [
  { id: "brush-teeth", emoji: "🪥", title: "Brush teeth", targetCount: 2, period: "day" },
  { id: "read-together", emoji: "📖", title: "Read a book together", targetCount: 1, period: "day" },
  { id: "tidy-toys", emoji: "🧸", title: "Tidy my toys", targetCount: 1, period: "day" },
  { id: "bath", emoji: "🛁", title: "Bath time", targetCount: 1, period: "day" },
  { id: "veggies", emoji: "🥦", title: "Eat vegetables", targetCount: 1, period: "day" },
  { id: "bedtime", emoji: "😴", title: "Go to bed on time", targetCount: 1, period: "day" },
  { id: "dressed", emoji: "👕", title: "Get dressed by myself", targetCount: 1, period: "day" },
  { id: "wash-hands", emoji: "🧼", title: "Wash hands before eating", targetCount: 3, period: "day" },
  { id: "water", emoji: "💧", title: "Drink water", targetCount: 4, period: "day" },
  { id: "outside", emoji: "🌳", title: "Play outside", targetCount: 1, period: "day" },
  { id: "please-thanks", emoji: "💛", title: "Say please and thank you", targetCount: 1, period: "day" },
  { id: "chore", emoji: "🧺", title: "Help with a chore", targetCount: 1, period: "day" },
] as const;

export type KidTemplate = (typeof KID_TEMPLATES)[number];
export type KidTemplateId = KidTemplate["id"];

export const DEFAULT_KID_TEMPLATE_IDS = ["brush-teeth", "read-together", "tidy-toys"] as const;

export const isKidTemplateId = (v: string): v is KidTemplateId => KID_TEMPLATES.some((t) => t.id === v);
