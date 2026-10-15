// supabase/functions/_shared/levels.ts
// XP → level (ideas/achievements-and-rewards.md §3). Mirrors private.level_for in the database:
// level = floor(sqrt(xp / 50)) + 1. Shared by the app (lib/levels.ts) and send-push (Deno).
import type { T } from "./i18n.ts";

// Level codes: identifiers, shown through the catalog (`levels.<code>`).
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

// Profile's level line: "Level 7 · Sprout" and "650 XP to Level 8".
export function levelLine(t: T, xp: number): { title: string; toNext: string } {
  const p = levelProgress(xp);
  return {
    title: t("levels.line", { level: String(p.level), name: t(`levels.${p.name}`) }),
    toNext: t("levels.toNext", { xp: String(p.toNext), next: String(p.level + 1) }),
  };
}
