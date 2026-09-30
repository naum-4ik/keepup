// ideas/achievements-and-rewards.md §8 and ideas/kid-view-next.md §2. Stages mirror
// private.garden_stage(): 0 / 3 / 7 / 12 / 18 stars in the week. Each theme grows the same way, drawn
// with simple emoji on a soft background (no characters, no text-heavy UI).
export type KidThemeId = "garden" | "aquarium" | "space" | "dino" | "town";
export type Stage = { min: number; label: string; icon: string; layers: readonly string[] };

export const GARDEN_STAGES: readonly Stage[] = [
  { min: 0, label: "A seed in the soil", icon: "🟫", layers: ["🟫"] },
  { min: 3, label: "A sprout", icon: "🌱", layers: ["🟫", "🌱"] },
  { min: 7, label: "The first flower", icon: "🌷", layers: ["🟫", "🌱", "🌷"] },
  { min: 12, label: "Flowers and a butterfly", icon: "🦋", layers: ["🟫", "🌷", "🌼", "🦋"] },
  { min: 18, label: "A full garden", icon: "🌻", layers: ["🟫", "🌷", "🌼", "🌻", "🦋", "🐞", "☀️"] },
];

// `sky` and `ground` are the picture's background; the first layer is always the ground (drawn as a band).
export const KID_THEMES: readonly { id: KidThemeId; name: string; icon: string; sky: string; ground: string; stages: readonly Stage[] }[] = [
  {
    id: "garden",
    name: "Garden",
    icon: "🌻",
    sky: "from-[#E3F1FA] to-[#E5F2E6] dark:from-[#3B82B8]/20 dark:to-[#4F8A5B]/20",
    ground: "bg-[#8A6B45]/35 dark:bg-[#8A6B45]/50",
    stages: GARDEN_STAGES,
  },
  {
    id: "aquarium",
    name: "Aquarium",
    icon: "🐠",
    sky: "from-[#D6ECF7] to-[#B9DDF0] dark:from-[#3B82B8]/30 dark:to-[#3B82B8]/50",
    ground: "bg-[#E8D9B5] dark:bg-[#8A6B45]/50",
    stages: [
      { min: 0, label: "Clear water", icon: "💧", layers: ["🟫"] },
      { min: 3, label: "Seaweed", icon: "🌿", layers: ["🟫", "🌿"] },
      { min: 7, label: "A fish", icon: "🐠", layers: ["🟫", "🌿", "🐠"] },
      { min: 12, label: "Fish and a shell", icon: "🐚", layers: ["🟫", "🌿", "🐠", "🐟", "🐚"] },
      { min: 18, label: "A full reef", icon: "🐙", layers: ["🟫", "🪸", "🐠", "🐟", "🐡", "🐙", "🐚"] },
    ],
  },
  {
    id: "space",
    name: "Space",
    icon: "🚀",
    sky: "from-[#3A3566] to-[#5B5490] dark:from-[#1E1B3A] dark:to-[#3A3566]",
    ground: "bg-[#8A7F76]/60",
    stages: [
      { min: 0, label: "A launch pad", icon: "🏁", layers: ["🟫", "🏁"] },
      { min: 3, label: "A rocket", icon: "🚀", layers: ["🟫", "🚀"] },
      { min: 7, label: "The moon", icon: "🌙", layers: ["🟫", "🚀", "🌙"] },
      { min: 12, label: "Planets", icon: "🪐", layers: ["🟫", "🚀", "🌙", "🪐"] },
      { min: 18, label: "A starry galaxy", icon: "🌌", layers: ["🟫", "🚀", "🌙", "🪐", "⭐", "🌟", "☄️"] },
    ],
  },
  {
    id: "dino",
    name: "Dino egg",
    icon: "🦖",
    sky: "from-[#FBF3D9] to-[#E5F2E6] dark:from-[#B08A1E]/20 dark:to-[#4F8A5B]/20",
    ground: "bg-[#8A6B45]/35 dark:bg-[#8A6B45]/50",
    stages: [
      { min: 0, label: "An egg", icon: "🥚", layers: ["🟫", "🥚"] },
      { min: 3, label: "The egg is cracking", icon: "✨", layers: ["🟫", "🥚", "✨"] },
      { min: 7, label: "A baby dino", icon: "🦎", layers: ["🟫", "🦎"] },
      { min: 12, label: "A dino and its nest", icon: "🦕", layers: ["🟫", "🦕", "🪺"] },
      { min: 18, label: "A grown-up dino", icon: "🦖", layers: ["🟫", "🌴", "🦖", "🦕", "🌋"] },
    ],
  },
  {
    id: "town",
    name: "Town",
    icon: "🏡",
    sky: "from-[#E3F1FA] to-[#F1EADF] dark:from-[#3B82B8]/20 dark:to-[#8A6B45]/20",
    ground: "bg-[#4F8A5B]/35 dark:bg-[#4F8A5B]/50",
    stages: [
      { min: 0, label: "An empty field", icon: "🌾", layers: ["🟫", "🌾"] },
      { min: 3, label: "A house", icon: "🏠", layers: ["🟫", "🏠"] },
      { min: 7, label: "A house and a tree", icon: "🌳", layers: ["🟫", "🏠", "🌳"] },
      { min: 12, label: "A street", icon: "🚗", layers: ["🟫", "🏠", "🌳", "🏡", "🚗"] },
      { min: 18, label: "A little town", icon: "🏫", layers: ["🟫", "🏠", "🏡", "🌳", "🏫", "🚗", "☀️"] },
    ],
  },
];

export const isKidTheme = (v: string | null | undefined): v is KidThemeId => KID_THEMES.some((t) => t.id === v);
export const kidTheme = (id: string | null | undefined) => KID_THEMES.find((t) => t.id === id) ?? KID_THEMES[0];
export const themeStages = (id: string | null | undefined): readonly Stage[] => kidTheme(id).stages;

export type GardenStage = 0 | 1 | 2 | 3 | 4;

export function stageFor(stars: number): GardenStage {
  let s = 0;
  GARDEN_STAGES.forEach((g, i) => {
    if (stars >= g.min) s = i;
  });
  return s as GardenStage;
}

export function starsToNext(stars: number): number | null {
  const next = GARDEN_STAGES.find((g) => g.min > stars);
  return next ? next.min - stars : null;
}

// The kid view's "what's next": stars collected since the current picture, how many the next one
// needs, and a small preview of it (`icon`) in the child's theme. Null once it's full.
export function nextStep(
  stars: number,
  theme?: string | null,
): { have: number; need: number; left: number; icon: string; label: string } | null {
  const stages = themeStages(theme);
  const now = stages[stageFor(stars)];
  const next = stages.find((g) => g.min > stars);
  if (!next) return null;
  return { have: stars - now.min, need: next.min - now.min, left: next.min - stars, icon: next.icon, label: next.label };
}
