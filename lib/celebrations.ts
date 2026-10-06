import { levelName } from "@/lib/levels";
import { badgeUnlocked, levelUp } from "@/lib/notification-copy";

// Level-ups and new badges get a moment, once each (ideas/achievements-and-rewards.md §9).
export type CelebrationMode = "full" | "subtle";
export const isCelebrationMode = (v: unknown): v is CelebrationMode => v === "full" || v === "subtle";

export type Celebration =
  | { kind: "level"; level: number; title: string; line: string }
  | { kind: "badge"; code: string; icon: string; title: string; line: string };

// The highest unseen level (seeing it marks every lower one seen), then up to three badges, oldest
// first; any others wait for the next page.
export function celebrationQueue(levels: { level: number }[], badges: { code: string; name: string; icon: string; unlockedAt: string }[]): Celebration[] {
  const out: Celebration[] = [];
  const top = levels.reduce((m, l) => Math.max(m, l.level), 0);
  if (top >= 2) {
    const c = levelUp(top, levelName(top));
    out.push({ kind: "level", level: top, title: c.title, line: c.body });
  }
  [...badges]
    .sort((a, b) => a.unlockedAt.localeCompare(b.unlockedAt) || a.code.localeCompare(b.code))
    .slice(0, 3)
    .forEach((b) => {
      const c = badgeUnlocked(b.name);
      out.push({ kind: "badge", code: b.code, icon: b.icon, title: c.title, line: c.body });
    });
  return out;
}

// What the moment marks seen (POST /api/celebrations): a level from 2 up, or a badge code. Anything else
// is refused.
export type SeenItem = { level: number } | { badge: string };
export function parseSeen(body: unknown): SeenItem | null {
  const b = body as { level?: unknown; badge?: unknown } | null;
  if (typeof b?.level === "number") return Number.isInteger(b.level) && b.level >= 2 && b.level <= 1000 ? { level: b.level } : null;
  if (typeof b?.badge === "string") return /^[a-z_]{1,40}$/.test(b.badge) ? { badge: b.badge } : null;
  return null;
}
