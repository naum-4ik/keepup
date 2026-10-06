import { stageFor } from "@/lib/garden";

// The big reveal (ideas/kid-view-next.md, decided 2026-10-05 and 2026-10-06): every tap that earns a
// star shows the scene item it adds huge in the middle of the screen, then flies it to its spot in the
// picture, a partial tap of a 2×-a-day habit too. A tap that reaches a new picture plays its item's
// reveal first, then the milestone (one after the other, never one instead of the other).
export type MomentKind = "reveal" | "milestone";

export function momentsForTap({ starsBefore }: { starsBefore: number }): MomentKind[] {
  return stageFor(starsBefore + 1) > stageFor(starsBefore) ? ["reveal", "milestone"] : ["reveal"];
}

// The reveal's timeline from its start: big in the middle from SHOW_AT (springs in, sparkles, one
// wiggle), shrinking to its spot from FLY_AT, landed at LAND_AT. A milestone stays big for MILESTONE_MS.
export const SHOW_AT = 100;
export const FLY_AT = 1600;
export const LAND_AT = 2200;
export const MILESTONE_MS = 2000;
// A moment is on screen at least this long before a newer tap's moment may cut it short; CUT_AT is
// that point from the moment's start (a reveal draws nothing before SHOW_AT).
export const MIN_ON_SCREEN = 800;
export const CUT_AT: Record<MomentKind, number> = { reveal: SHOW_AT + MIN_ON_SCREEN, milestone: MIN_ON_SCREEN };

export type Phase = "enter" | "show" | "fly";
export type Moment<T> = { id: number; kind: MomentKind; phase: Phase; data: T };
// One tap's moments, in order. `instant` (Reduce Motion): it lands right away, no phases.
export type Step<T> = { kind: MomentKind; data: T; instant?: boolean };

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
  // Queues a tap's moments. One plays at a time; a later tap's moment waits until the one playing has
  // been on screen for its minimum (CUT_AT), then that one lands at once and the next starts. The
  // moments of one tap play in full one after the other. An instant one never waits: everything
  // before it lands at once.
  play: (steps: readonly Step<T>[]) => void;
  // Lands what plays and everything waiting, in order (the page went to the background).
  fastForward: () => void;
  current: () => Moment<T> | null;
  // Unmount: stops the timers and drops what waits, without landing. It stays usable (React may mount
  // it again).
  dispose: () => void;
};

type Waiting<T> = Step<T> & { tap: number };

// `change` hears every phase (null once nothing plays, never between two queued ones); `land` hears
// each moment exactly once, after its last phase or when it's cut short (`skipped`), always before the
// next one's first phase.
export function createMoments<T>({
  change,
  land,
}: {
  change: (m: Moment<T> | null) => void;
  land: (m: Moment<T>, skipped: boolean) => void;
}): Moments<T> {
  let now: Moment<T> | null = null;
  let nowTap = 0;
  let seenEnough = false;
  let queue: Waiting<T>[] = [];
  let timers: ReturnType<typeof setTimeout>[] = [];
  let seq = 0;
  let taps = 0;

  const clear = () => {
    timers.forEach((t) => clearTimeout(t));
    timers = [];
  };

  // Lands what plays (if anything); true when something was showing.
  const finish = (skipped: boolean) => {
    const m = now;
    if (!m) return false;
    clear();
    now = null;
    land(m, skipped);
    return true;
  };

  const newerWaits = () => queue.some((w) => w.tap !== nowTap);

  // Starts the next one waiting (instant ones land on the way); `wasShowing` says whether to tell
  // `change` that nothing plays any more.
  const next = (wasShowing: boolean) => {
    for (let w = queue.shift(); w; w = queue.shift()) {
      const id = ++seq;
      if (w.instant) {
        land({ id, kind: w.kind, phase: "enter", data: w.data }, false);
        continue;
      }
      start(id, w);
      return;
    }
    if (wasShowing) change(null);
  };

  const cut = () => next(finish(true));

  const start = (id: number, { kind, data, tap }: Waiting<T>) => {
    nowTap = tap;
    seenEnough = false;
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
        seenEnough = true;
        if (newerWaits()) cut();
      }, CUT_AT[kind]),
    );
    timers.push(setTimeout(() => next(finish(false)), END[kind]));
  };

  const drain = () => {
    let wasShowing = finish(true);
    for (let w = queue.shift(); w; w = queue.shift()) {
      land({ id: ++seq, kind: w.kind, phase: "enter", data: w.data }, true);
      wasShowing = true;
    }
    return wasShowing;
  };

  return {
    play(steps) {
      const tap = ++taps;
      if (steps.length === 0) return;
      if (steps[0].instant) {
        // Reduce Motion: nothing waits for an overlay it can't see.
        const wasShowing = drain();
        queue = steps.map((s) => ({ ...s, tap }));
        next(wasShowing);
        return;
      }
      queue.push(...steps.map((s) => ({ ...s, tap })));
      if (!now) next(false);
      else if (seenEnough && newerWaits()) cut();
    },
    fastForward() {
      if (drain()) change(null);
    },
    current: () => now,
    dispose() {
      clear();
      queue = [];
      now = null;
    },
  };
}
