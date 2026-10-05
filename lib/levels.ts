// lib/levels.ts
// The level helpers live with the Edge Functions so send-push (Deno) and the app share one file.
import { levelProgress } from "../supabase/functions/_shared/levels";
export * from "../supabase/functions/_shared/levels";

// How far through the current level, 0 to <1 (the avatar's ring). Never 1: at the next level's XP the
// level has already turned over and the ring starts again. Bad input (NaN, negative) reads as 0.
export function levelFraction(xp: number): number {
  const { into, span } = levelProgress(Number.isFinite(xp) ? xp : 0);
  return Math.min(Math.max(into / span, 0), 1 - Number.EPSILON);
}
