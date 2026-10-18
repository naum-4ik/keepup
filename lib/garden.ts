import type { T } from "@/supabase/functions/_shared/i18n";

// ideas/achievements-and-rewards.md §8 and ideas/kid-view-next.md §2. Stages mirror
// private.garden_stage(): 0 / 3 / 7 / 12 / 18 stars in the week. Each theme grows the same way: one big
// picture per stage (`icon`, the hero of the scene, ideas/kid-view-next.md §4) on its own sky, so a new
// stage looks new at a glance. Taps add small items around it (lib/scene-items.ts); they never change
// the sky. Skies are full class strings so Tailwind sees them.
export type KidThemeId = "garden" | "aquarium" | "space" | "dino" | "town";
export type Stage = { min: number; icon: string; sky: string };

export const GARDEN_STAGES: readonly Stage[] = [
  { min: 0, icon: "🌰", sky: "from-[#F1EADF] to-[#E9F0E2] dark:from-[#8A6B45]/20 dark:to-[#4F8A5B]/15" },
  { min: 3, icon: "🌱", sky: "from-[#E3F1FA] to-[#E5F2E6] dark:from-[#3B82B8]/20 dark:to-[#4F8A5B]/20" },
  { min: 7, icon: "🌷", sky: "from-[#CDE7F8] to-[#E3F4D6] dark:from-[#3B82B8]/30 dark:to-[#4F8A5B]/25" },
  { min: 12, icon: "🦋", sky: "from-[#FCE3EC] to-[#E3F4D6] dark:from-[#B8527A]/25 dark:to-[#4F8A5B]/25" },
  { min: 18, icon: "🌻", sky: "from-[#FFE7A3] to-[#FBD5C0] dark:from-[#B08A1E]/35 dark:to-[#B8527A]/25" },
];

// `ground` is the strip at the bottom, the same for every stage.
export const KID_THEMES: readonly { id: KidThemeId; icon: string; ground: string; stages: readonly Stage[] }[] = [
  {
    id: "garden",
    icon: "🌻",
    ground: "bg-[#8A6B45]/35 dark:bg-[#8A6B45]/50",
    stages: GARDEN_STAGES,
  },
  {
    id: "aquarium",
    icon: "🐠",
    ground: "bg-[#E8D9B5] dark:bg-[#8A6B45]/50",
    stages: [
      { min: 0, icon: "💧", sky: "from-[#EEF7FB] to-[#D6ECF7] dark:from-[#3B82B8]/15 dark:to-[#3B82B8]/25" },
      { min: 3, icon: "🌿", sky: "from-[#D6ECF7] to-[#B5E0D8] dark:from-[#3B82B8]/25 dark:to-[#2E8B7A]/35" },
      { min: 7, icon: "🐠", sky: "from-[#BFE3F5] to-[#8FCBE8] dark:from-[#3B82B8]/35 dark:to-[#3B82B8]/50" },
      { min: 12, icon: "🐚", sky: "from-[#A6E3E9] to-[#6FB8DD] dark:from-[#2E8B9A]/40 dark:to-[#2F6FA8]/55" },
      { min: 18, icon: "🐙", sky: "from-[#8FE0D2] via-[#62B5E0] to-[#4A7FC8] dark:from-[#2E8B7A]/50 dark:via-[#2F6FA8]/55 dark:to-[#3A4FA0]/60" },
    ],
  },
  {
    id: "space",
    icon: "🚀",
    ground: "bg-[#8A7F76]/60",
    stages: [
      { min: 0, icon: "🏁", sky: "from-[#1C1B33] to-[#2E2B4F]" },
      { min: 3, icon: "🚀", sky: "from-[#2B2559] to-[#4A3C7A]" },
      { min: 7, icon: "🌙", sky: "from-[#3A2466] to-[#7A4C9E]" },
      { min: 12, icon: "🪐", sky: "from-[#1B3263] via-[#2F5A9E] to-[#4A3C8C]" },
      { min: 18, icon: "🌟", sky: "from-[#24154A] via-[#5B3A8C] to-[#B65A93]" },
    ],
  },
  {
    id: "dino",
    icon: "🦖",
    ground: "bg-[#8A6B45]/35 dark:bg-[#8A6B45]/50",
    stages: [
      { min: 0, icon: "🥚", sky: "from-[#FBF3D9] to-[#F1EADF] dark:from-[#B08A1E]/15 dark:to-[#8A6B45]/20" },
      { min: 3, icon: "🐣", sky: "from-[#FBF3D9] to-[#E5F2E6] dark:from-[#B08A1E]/20 dark:to-[#4F8A5B]/20" },
      { min: 7, icon: "🦎", sky: "from-[#DDF1D0] to-[#BFE3B4] dark:from-[#4F8A5B]/25 dark:to-[#4F8A5B]/40" },
      { min: 12, icon: "🦕", sky: "from-[#FFE2B8] to-[#D8EDC4] dark:from-[#C2783A]/25 dark:to-[#4F8A5B]/30" },
      { min: 18, icon: "🦖", sky: "from-[#FFD3A0] via-[#F6AE88] to-[#E58A7A] dark:from-[#C2783A]/40 dark:via-[#B8527A]/35 dark:to-[#8A3A3A]/45" },
    ],
  },
  {
    id: "town",
    icon: "🏡",
    ground: "bg-[#4F8A5B]/35 dark:bg-[#4F8A5B]/50",
    stages: [
      { min: 0, icon: "🌾", sky: "from-[#F1EADF] to-[#F4EFD8] dark:from-[#8A6B45]/20 dark:to-[#B08A1E]/15" },
      { min: 3, icon: "🏠", sky: "from-[#E3F1FA] to-[#F1EADF] dark:from-[#3B82B8]/20 dark:to-[#8A6B45]/20" },
      { min: 7, icon: "🌳", sky: "from-[#CDE7F8] to-[#E3F4D6] dark:from-[#3B82B8]/30 dark:to-[#4F8A5B]/25" },
      { min: 12, icon: "🚗", sky: "from-[#D9E1FA] to-[#F8E3CF] dark:from-[#4A5BA8]/30 dark:to-[#C2783A]/25" },
      { min: 18, icon: "🏫", sky: "from-[#FFE4B0] via-[#FBC9B4] to-[#D9C2EC] dark:from-[#B08A1E]/35 dark:via-[#B8527A]/30 dark:to-[#6B4C9A]/35" },
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
// The kid's gender as the copy's {gender, select, …} wants it; unknown is neutral wording ("other").
export type Gender = "boy" | "girl" | null;
const genderOf = (gender: Gender) => gender ?? "other";

// kidThemes.<theme>.name and .stages.<n>: the theme's name and the label of its n-th picture.
export const themeName = (t: T, theme: string | null | undefined): string => t(`kidThemes.${kidTheme(theme).id}.name`);
export const stageLabel = (t: T, theme: string | null | undefined, stars: number): string =>
  t(`kidThemes.${kidTheme(theme).id}.stages.${stageFor(stars)}`);
const labelAt = (t: T, theme: KidThemeId, index: number): string => t(`kidThemes.${theme}.stages.${index}`);

// The kid view's "what's next": stars collected since the current picture, how many the next one
// needs, and a small preview of it (`icon`) in the child's theme. Null once it's full.
export function nextStep(
  t: T,
  stars: number,
  theme?: string | null,
): { have: number; need: number; left: number; icon: string; label: string } | null {
  const { id, stages } = kidTheme(theme);
  const now = stages[stageFor(stars)];
  const nextIndex = stages.findIndex((g) => g.min > stars);
  if (nextIndex < 0) return null;
  const next = stages[nextIndex];
  return { have: stars - now.min, need: next.min - now.min, left: next.min - stars, icon: next.icon, label: labelAt(t, id, nextIndex) };
}

// The kid page's "what's next": this week's picture, and how many stars to the next one, by name
// (owner, 2026-10-01: "5 more stars" alone, just after a new picture, read as going backwards).
export function stepLines(t: T, stars: number, theme?: string | null, gender: Gender = null): { now: string; next: string | null } {
  const { id, stages } = kidTheme(theme);
  const index = stageFor(stars);
  const next = nextStep(t, stars, id);
  return {
    now: `${labelAt(t, id, index)} ${stages[index].icon}`,
    // kidThemes.<theme>.toStage: the picture's name as it reads after "to" (its own form per language).
    next: next && t("garden.starsToNext", { gender: genderOf(gender), left: next.left, label: t(`kidThemes.${id}.toStage.${stages.findIndex((g) => g.min > stars)}`), icon: next.icon }),
  };
}

// ideas/kid-view-next.md: when it starts over (the family group's first day of the week) and how the
// new week is announced, in the child's theme. The emoji are the scene's, not the language's.
const THEME_START: Record<KidThemeId, string> = { garden: "🌱", aquarium: "💧", space: "🚀", dino: "🥚", town: "🏠" };

// This week started on weekStart, so the next one starts 7 days later, on the same weekday. Weeks
// start on Sunday or Monday only (groups.week_start in (0, 1)); the messages name the day.
export type WeekStartDay = "sun" | "mon";
export const restartDay = (weekStart: string): WeekStartDay => (new Date(`${weekStart}T00:00:00Z`).getUTCDay() === 0 ? "sun" : "mon");

export function restartLine(t: T, theme: string | null | undefined, day: WeekStartDay, full: boolean, gender: Gender = null): string {
  const { id, stages } = kidTheme(theme);
  if (full) {
    const last = stages[stages.length - 1];
    const done = id === "garden" ? t("garden.fullGarden") : t("garden.stageDone", { label: labelAt(t, id, stages.length - 1), icon: last.icon });
    return t("garden.restartFull", { gender: genderOf(gender), done, weekStart: day });
  }
  return t("garden.restart", { gender: genderOf(gender), noun: t(`kidThemes.${id}.noun`), weekStart: day, start: THEME_START[id] });
}

export function newWeekLine(t: T, theme: string | null | undefined, gender: Gender = null): string {
  const { id } = kidTheme(theme);
  return t("garden.newWeek", { gender: genderOf(gender), noun: t(`kidThemes.${id}.noun`), seed: t(`kidThemes.${id}.seed`) });
}

// Last week's entry in the album (the week just before weekStart), if it had any stars.
export function lastWeek<T extends { week_start: string; stars: number }>(weekStart: string, album: T[]): T | null {
  const prev = new Date(new Date(`${weekStart}T00:00:00Z`).getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
  return album.find((w) => w.week_start === prev && w.stars > 0) ?? null;
}
