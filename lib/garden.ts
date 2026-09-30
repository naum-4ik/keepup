// ideas/achievements-and-rewards.md §8. Mirrors private.garden_stage().
export const GARDEN_STAGES = [
  { min: 0, label: "A seed in the soil", icon: "🟫", layers: ["🟫"] },
  { min: 3, label: "A sprout", icon: "🌱", layers: ["🟫", "🌱"] },
  { min: 7, label: "The first flower", icon: "🌷", layers: ["🟫", "🌱", "🌷"] },
  { min: 12, label: "Flowers and a butterfly", icon: "🦋", layers: ["🟫", "🌷", "🌼", "🦋"] },
  { min: 18, label: "A full garden", icon: "🌻", layers: ["🟫", "🌷", "🌼", "🌻", "🦋", "🐞", "☀️"] },
] as const;

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
// needs, and a small preview of it (`icon`). Null once the garden is full.
export function nextStep(stars: number): { have: number; need: number; left: number; icon: string; label: string } | null {
  const now = GARDEN_STAGES[stageFor(stars)];
  const next = GARDEN_STAGES.find((g) => g.min > stars);
  if (!next) return null;
  return { have: stars - now.min, need: next.min - now.min, left: next.min - stars, icon: next.icon, label: next.label };
}
