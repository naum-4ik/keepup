// ideas/achievements-and-rewards.md §8 and ideas/kid-view-next.md §2. Stages mirror
// private.garden_stage(): 0 / 3 / 7 / 12 / 18 stars in the week. Each theme grows the same way: one big
// picture per stage (`icon`, the hero of the scene, ideas/kid-view-next.md §4) on its own sky, so a new
// stage looks new at a glance. Taps add small items around it (lib/scene-items.ts); they never change
// the sky. Skies are full class strings so Tailwind sees them.
export type KidThemeId = "garden" | "aquarium" | "space" | "dino" | "town";
export type Stage = { min: number; label: string; icon: string; sky: string };

export const GARDEN_STAGES: readonly Stage[] = [
  { min: 0, label: "A seed in the soil", icon: "🌰", sky: "from-[#F1EADF] to-[#E9F0E2] dark:from-[#8A6B45]/20 dark:to-[#4F8A5B]/15" },
  { min: 3, label: "A sprout", icon: "🌱", sky: "from-[#E3F1FA] to-[#E5F2E6] dark:from-[#3B82B8]/20 dark:to-[#4F8A5B]/20" },
  { min: 7, label: "The first flower", icon: "🌷", sky: "from-[#CDE7F8] to-[#E3F4D6] dark:from-[#3B82B8]/30 dark:to-[#4F8A5B]/25" },
  { min: 12, label: "Flowers and a butterfly", icon: "🦋", sky: "from-[#FCE3EC] to-[#E3F4D6] dark:from-[#B8527A]/25 dark:to-[#4F8A5B]/25" },
  { min: 18, label: "A full garden", icon: "🌻", sky: "from-[#FFE7A3] to-[#FBD5C0] dark:from-[#B08A1E]/35 dark:to-[#B8527A]/25" },
];

// `ground` is the strip at the bottom, the same for every stage.
export const KID_THEMES: readonly { id: KidThemeId; name: string; icon: string; ground: string; stages: readonly Stage[] }[] = [
  {
    id: "garden",
    name: "Garden",
    icon: "🌻",
    ground: "bg-[#8A6B45]/35 dark:bg-[#8A6B45]/50",
    stages: GARDEN_STAGES,
  },
  {
    id: "aquarium",
    name: "Aquarium",
    icon: "🐠",
    ground: "bg-[#E8D9B5] dark:bg-[#8A6B45]/50",
    stages: [
      { min: 0, label: "Clear water", icon: "💧", sky: "from-[#EEF7FB] to-[#D6ECF7] dark:from-[#3B82B8]/15 dark:to-[#3B82B8]/25" },
      { min: 3, label: "Seaweed", icon: "🌿", sky: "from-[#D6ECF7] to-[#B5E0D8] dark:from-[#3B82B8]/25 dark:to-[#2E8B7A]/35" },
      { min: 7, label: "A fish", icon: "🐠", sky: "from-[#BFE3F5] to-[#8FCBE8] dark:from-[#3B82B8]/35 dark:to-[#3B82B8]/50" },
      { min: 12, label: "Fish and a shell", icon: "🐚", sky: "from-[#A6E3E9] to-[#6FB8DD] dark:from-[#2E8B9A]/40 dark:to-[#2F6FA8]/55" },
      { min: 18, label: "A full reef", icon: "🐙", sky: "from-[#8FE0D2] via-[#62B5E0] to-[#4A7FC8] dark:from-[#2E8B7A]/50 dark:via-[#2F6FA8]/55 dark:to-[#3A4FA0]/60" },
    ],
  },
  {
    id: "space",
    name: "Space",
    icon: "🚀",
    ground: "bg-[#8A7F76]/60",
    stages: [
      { min: 0, label: "A launch pad", icon: "🏁", sky: "from-[#1C1B33] to-[#2E2B4F]" },
      { min: 3, label: "A rocket", icon: "🚀", sky: "from-[#2B2559] to-[#4A3C7A]" },
      { min: 7, label: "The moon", icon: "🌙", sky: "from-[#3A2466] to-[#7A4C9E]" },
      { min: 12, label: "Planets", icon: "🪐", sky: "from-[#1B3263] via-[#2F5A9E] to-[#4A3C8C]" },
      { min: 18, label: "A starry galaxy", icon: "🌟", sky: "from-[#24154A] via-[#5B3A8C] to-[#B65A93]" },
    ],
  },
  {
    id: "dino",
    name: "Dino egg",
    icon: "🦖",
    ground: "bg-[#8A6B45]/35 dark:bg-[#8A6B45]/50",
    stages: [
      { min: 0, label: "An egg", icon: "🥚", sky: "from-[#FBF3D9] to-[#F1EADF] dark:from-[#B08A1E]/15 dark:to-[#8A6B45]/20" },
      { min: 3, label: "A cracking egg", icon: "🐣", sky: "from-[#FBF3D9] to-[#E5F2E6] dark:from-[#B08A1E]/20 dark:to-[#4F8A5B]/20" },
      { min: 7, label: "A baby dino", icon: "🦎", sky: "from-[#DDF1D0] to-[#BFE3B4] dark:from-[#4F8A5B]/25 dark:to-[#4F8A5B]/40" },
      { min: 12, label: "A dino and its nest", icon: "🦕", sky: "from-[#FFE2B8] to-[#D8EDC4] dark:from-[#C2783A]/25 dark:to-[#4F8A5B]/30" },
      { min: 18, label: "A grown-up dino", icon: "🦖", sky: "from-[#FFD3A0] via-[#F6AE88] to-[#E58A7A] dark:from-[#C2783A]/40 dark:via-[#B8527A]/35 dark:to-[#8A3A3A]/45" },
    ],
  },
  {
    id: "town",
    name: "Town",
    icon: "🏡",
    ground: "bg-[#4F8A5B]/35 dark:bg-[#4F8A5B]/50",
    stages: [
      { min: 0, label: "An empty field", icon: "🌾", sky: "from-[#F1EADF] to-[#F4EFD8] dark:from-[#8A6B45]/20 dark:to-[#B08A1E]/15" },
      { min: 3, label: "A house", icon: "🏠", sky: "from-[#E3F1FA] to-[#F1EADF] dark:from-[#3B82B8]/20 dark:to-[#8A6B45]/20" },
      { min: 7, label: "A house and a tree", icon: "🌳", sky: "from-[#CDE7F8] to-[#E3F4D6] dark:from-[#3B82B8]/30 dark:to-[#4F8A5B]/25" },
      { min: 12, label: "A street", icon: "🚗", sky: "from-[#D9E1FA] to-[#F8E3CF] dark:from-[#4A5BA8]/30 dark:to-[#C2783A]/25" },
      { min: 18, label: "A little town", icon: "🏫", sky: "from-[#FFE4B0] via-[#FBC9B4] to-[#D9C2EC] dark:from-[#B08A1E]/35 dark:via-[#B8527A]/30 dark:to-[#6B4C9A]/35" },
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

// The kid page's "what's next": this week's picture, and how many stars to the next one, by name
// (owner, 2026-10-01: "5 more stars" alone, just after a new picture, read as going backwards).
export function stepLines(stars: number, theme?: string | null): { now: string; next: string | null } {
  const now = themeStages(theme)[stageFor(stars)];
  const next = nextStep(stars, theme);
  return {
    now: `${now.label} ${now.icon}`,
    next: next && `${next.left} more ${next.left === 1 ? "star" : "stars"} to ${next.label[0].toLowerCase()}${next.label.slice(1)} ${next.icon}`,
  };
}

// ideas/kid-view-next.md: when it starts over (the family group's first day of the week) and how the
// new week is announced, in the child's theme.
const THEME_WORDS: Record<KidThemeId, { noun: string; start: string; seed: string }> = {
  garden: { noun: "garden", start: "🌱", seed: "A new seed is planted 🌱" },
  aquarium: { noun: "aquarium", start: "💧", seed: "Fresh water is ready 💧" },
  space: { noun: "galaxy", start: "🚀", seed: "A new launch pad is ready 🚀" },
  dino: { noun: "dino egg", start: "🥚", seed: "A new egg is waiting 🥚" },
  town: { noun: "town", start: "🏠", seed: "A new field is ready 🌾" },
};

const DAY = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" });

// This week started on weekStart, so the next one starts 7 days later, on the same weekday.
export function restartDay(weekStart: string): string {
  return DAY.format(new Date(`${weekStart}T00:00:00Z`));
}

export function restartLine(theme: string | null | undefined, day: string, full: boolean): string {
  const t = kidTheme(theme);
  const words = THEME_WORDS[t.id];
  if (full) {
    const last = t.stages[t.stages.length - 1];
    const done = t.id === "garden" ? "Full garden! 🌻" : `${last.label}! ${last.icon}`;
    return `${done} A new one starts on ${day}`;
  }
  return `A new ${words.noun} starts on ${day} ${words.start}`;
}

export function newWeekLine(theme: string | null | undefined): string {
  const words = THEME_WORDS[kidTheme(theme).id];
  return `Last week's ${words.noun} is in the album 📸 ${words.seed}`;
}

// Last week's entry in the album (the week just before weekStart), if it had any stars.
export function lastWeek<T extends { week_start: string; stars: number }>(weekStart: string, album: T[]): T | null {
  const prev = new Date(new Date(`${weekStart}T00:00:00Z`).getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
  return album.find((w) => w.week_start === prev && w.stars > 0) ?? null;
}
