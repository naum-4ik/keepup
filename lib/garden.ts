// ideas/achievements-and-rewards.md §8. Mirrors private.garden_stage().
export const GARDEN_STAGES = [
  { min: 0, label: "A seed in the soil", layers: ["🟫"] },
  { min: 3, label: "A sprout", layers: ["🟫", "🌱"] },
  { min: 7, label: "The first flower", layers: ["🟫", "🌱", "🌷"] },
  { min: 12, label: "Flowers and a butterfly", layers: ["🟫", "🌷", "🌼", "🦋"] },
  { min: 18, label: "A full garden", layers: ["🟫", "🌷", "🌼", "🌻", "🦋", "🐞", "☀️"] },
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
