import { kidTheme, type KidThemeId } from "@/lib/garden";

// The kid view's idle motion (ideas/kid-view-next.md, decided 2026-10-04): when nothing happens, the
// scene moves gently by itself. Items sway or bob (CSS, small and slow), something drifts across now
// and then, and a sparkle shows on an item. Off with Reduce Motion, paused while a tap plays.

// Every 8–12 s a sparkle; every 20–30 s something drifts by (the first one sooner).
export const SPARKLE_EVERY = [8_000, 12_000] as const;
export const DRIFT_EVERY = [20_000, 30_000] as const;
export const FIRST_DRIFT = [5_000, 9_000] as const;

export const nextDelay = ([min, max]: readonly [number, number], rand: () => number = Math.random): number =>
  Math.round(min + (max - min) * Math.min(Math.max(rand(), 0), 1));

// What drifts across the sky: never a stage picture (owner, 2026-10-01: an item that looks like a stage
// makes the stage look like one more icon), so not the garden's 🦋 or the aquarium's 🐠.
const DRIFTERS: Record<KidThemeId, string> = {
  garden: "☁️",
  aquarium: "🐡",
  space: "☄️",
  dino: "☁️",
  town: "☁️",
};
export const drifterFor = (theme?: string | null): string => DRIFTERS[kidTheme(theme).id];

// Each item's own idle motion, fixed by its place in the scene (no randomness, so the server and the
// client agree): sway or bob, a 3–6 s cycle, and a start offset so they don't move in step.
export type IdleMotion = { kind: "sway" | "bob"; seconds: number; delay: number };
export function idleMotion(i: number): IdleMotion {
  return {
    kind: i % 2 === 0 ? "sway" : "bob",
    seconds: 3 + ((i * 7) % 7) * 0.5,
    delay: -(((i * 5) % 11) * 0.45),
  };
}
