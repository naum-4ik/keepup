import { kidTheme, type KidThemeId } from "@/lib/garden";

// ideas/kid-view-next.md §4: every tap (a star) adds one thing to the week's scene, so a toddler sees
// "I did it → a flower appeared" at once. Items are picked in a fixed order and stand on fixed spots,
// so the same stars always draw the same scene; past 25 the scene is full and stays as it is.
export const MAX_ITEMS = 25;

// Never a stage picture (owner, 2026-10-01: a 🌙 item made the moon stage look like one more icon).
// Not 🌠 or 🌌: on iPhone they are framed photos, not shapes.
const ITEMS: Record<KidThemeId, readonly string[]> = {
  garden: ["🌸", "🍄", "🪻", "🐝", "🐌", "🍀"],
  aquarium: ["🫧", "🦀", "🦐", "🐬", "🐋", "🦑"],
  space: ["✨", "🛰️", "💫", "⭐", "🛸", "🌍"],
  dino: ["🌿", "🦴", "🪨", "🍃", "🐾", "🌾"],
  town: ["🚲", "🌷", "🚌", "🌲", "🚦", "⛲"],
};

export const tapItems = (theme?: string | null): readonly string[] => ITEMS[kidTheme(theme).id];

type Spot = readonly [x: number, y: number, scale: number];
const rows = (y: number, scale: number, xs: number[]): Spot[] => xs.map((x) => [x, y, scale] as const);

// Spots in % of the picture (x from the left, y from the top). Things that stand (garden, dino, town)
// stand on a tall strip of ground in three rows, smaller further back; `y` is where they touch the
// ground. The stage picture stands just behind them in the middle. Things that float (aquarium, space)
// fill the picture around the stage picture, which floats in the middle (HERO_BOX), centred on `y`.
// In the order they fill: the front row first, from the middle out, so the first taps are big and
// easy to see; then the rows further back (drawn behind), the middle of the back row last, since the
// stage picture covers it most.
const GROUND: readonly Spot[] = [
  ...rows(96, 1, [46, 58, 34, 70, 22, 82, 10, 94]),
  ...rows(89, 0.85, [42, 54, 30, 66, 18, 78, 6, 90]),
  ...rows(82, 0.7, [28, 72, 17, 83, 6, 94, 39, 61, 50]),
];
export const HERO_BOX = { left: 32, right: 68, top: 20, bottom: 68 } as const;
const FLOAT: readonly Spot[] = [
  ...rows(10, 1, [8, 24, 40, 56, 72, 88]),
  ...rows(26, 1, [10, 22, 78, 90]),
  ...rows(42, 1, [8, 20, 80, 92]),
  ...rows(58, 1, [10, 22, 78, 90]),
  ...rows(76, 1, [8, 22, 36, 50, 64, 78, 92]),
];
const FLOATING: ReadonlySet<KidThemeId> = new Set(["aquarium", "space"]);

export const isFloatingTheme = (theme?: string | null): boolean => FLOATING.has(kidTheme(theme).id);

export type SceneItem = { emoji: string; x: number; y: number; scale: number; standing: boolean };

export function sceneItems(stars: number, theme?: string | null): SceneItem[] {
  const id = kidTheme(theme).id;
  const standing = !FLOATING.has(id);
  const spots = standing ? GROUND : FLOAT;
  const items = ITEMS[id];
  return Array.from({ length: Math.min(Math.max(stars, 0), MAX_ITEMS) }, (_, i) => {
    // Floating things jump around the picture (7 and 25 share no factor, so every spot is visited once);
    // standing ones fill the rows in order.
    const [x, y, scale] = spots[standing ? i : (i * 7) % MAX_ITEMS];
    return { emoji: items[i % items.length], x, y, scale, standing };
  });
}
