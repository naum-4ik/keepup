// supabase/functions/_shared/levels.ts
// XP → level (ideas/achievements-and-rewards.md §3). Mirrors private.level_for in the database:
// level = floor(sqrt(xp / 50)) + 1. Shared by the app (lib/levels.ts) and send-push (Deno).
export type LevelName = "Seedling" | "Sprout" | "Sapling" | "Tree" | "Forest";

export function levelFor(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
}

// The XP where a level starts: 50 × (level − 1)².
export function xpForLevel(level: number): number {
  return 50 * (Math.max(1, Math.floor(level)) - 1) ** 2;
}

export function levelName(level: number): LevelName {
  if (level <= 5) return "Seedling";
  if (level <= 10) return "Sprout";
  if (level <= 15) return "Sapling";
  if (level <= 20) return "Tree";
  return "Forest";
}

export function levelProgress(xp: number): { level: number; name: LevelName; into: number; span: number; toNext: number } {
  const total = Math.max(0, xp);
  const level = levelFor(total);
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  return { level, name: levelName(level), into: total - from, span: to - from, toNext: to - total };
}
