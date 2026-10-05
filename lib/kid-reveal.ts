import { stageFor } from "@/lib/garden";

// The big reveal (ideas/kid-view-next.md, decided 2026-10-05): a tap that finishes a habit shows the
// scene item it adds huge in the middle of the screen, then flies it to its spot in the picture. A tap
// that reaches a new picture plays the milestone instead (never both), and a tap that only counts part
// of a 2×-a-day habit keeps the small effect (the item flies from the card).
export type TapKind = "milestone" | "reveal" | "partial";

export function kindOfTap({ starsBefore, done, target }: { starsBefore: number; done: number; target: number }): TapKind {
  if (stageFor(starsBefore + 1) > stageFor(starsBefore)) return "milestone";
  return done + 1 >= target ? "reveal" : "partial";
}

// The reveal's timeline from the tap: big in the middle from SHOW_AT (springs in, sparkles, one wiggle),
// shrinking to its spot from FLY_AT, landed at LAND_AT. A milestone stays big for MILESTONE_MS.
export const SHOW_AT = 100;
export const FLY_AT = 1100;
export const LAND_AT = 1700;
export const MILESTONE_MS = 2000;

export type MomentKind = "reveal" | "milestone";
export type Phase = "enter" | "show" | "fly";
export type Moment<T> = { id: number; kind: MomentKind; phase: Phase; data: T };

const PHASES: Record<MomentKind, readonly (readonly [Phase, number])[]> = {
  reveal: [
    ["enter", 0],
    ["show", SHOW_AT],
    ["fly", FLY_AT],
  ],
  milestone: [["show", 0]],
};
const END: Record<MomentKind, number> = { reveal: LAND_AT, milestone: MILESTONE_MS };

export type Moments<T> = {
  // Starts a moment. One plays at a time: whatever is playing lands at once first (fast-forward), so
  // quick taps never wait and never stack. `instant` (Reduce Motion): it lands right away, no phases.
  play: (kind: MomentKind, data: T, opts?: { instant?: boolean }) => void;
  // Lands what's playing now (a tap that starts nothing big of its own, like a partial tap).
  fastForward: () => void;
  current: () => Moment<T> | null;
  // Unmount: stops the timers without landing anything. It stays usable (React may mount it again).
  dispose: () => void;
};

// `change` hears every phase (null once nothing plays); `land` hears each moment exactly once, after
// its last phase or when it's fast-forwarded (`skipped`), always before the next one's first phase.
export function createMoments<T>({
  change,
  land,
}: {
  change: (m: Moment<T> | null) => void;
  land: (m: Moment<T>, skipped: boolean) => void;
}): Moments<T> {
  let now: Moment<T> | null = null;
  let timers: ReturnType<typeof setTimeout>[] = [];
  let seq = 0;

  const clear = () => {
    timers.forEach((t) => clearTimeout(t));
    timers = [];
  };

  const finish = (skipped: boolean) => {
    const m = now;
    if (!m) return;
    clear();
    now = null;
    land(m, skipped);
  };

  return {
    play(kind, data, { instant = false } = {}) {
      const had = now !== null;
      finish(true);
      const id = ++seq;
      if (instant) {
        land({ id, kind, phase: "enter", data }, false);
        if (had) change(null);
        return;
      }
      for (const [phase, at] of PHASES[kind]) {
        const enter = () => {
          now = { id, kind, phase, data };
          change(now);
        };
        if (at === 0) enter();
        else timers.push(setTimeout(enter, at));
      }
      timers.push(
        setTimeout(() => {
          finish(false);
          change(null);
        }, END[kind]),
      );
    },
    fastForward() {
      if (!now) return;
      finish(true);
      change(null);
    },
    current: () => now,
    dispose() {
      clear();
      now = null;
    },
  };
}
