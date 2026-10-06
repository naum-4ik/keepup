import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMoments, CUT_AT, FLY_AT, LAND_AT, MILESTONE_MS, MIN_ON_SCREEN, momentsForTap, SHOW_AT, type Moment, type MomentKind } from "@/lib/kid-reveal";

describe("momentsForTap: every star is a big reveal, a new picture comes after it", () => {
  it("a tap that finishes the habit is a big reveal", () => {
    expect(momentsForTap({ starsBefore: 0 })).toEqual(["reveal"]);
    expect(momentsForTap({ starsBefore: 4 })).toEqual(["reveal"]);
  });
  it("part of a 2×-a-day habit is a big reveal too (it earns a star)", () => {
    // The tap's habit doesn't matter: done 0 of 2 adds a star like any other.
    expect(momentsForTap({ starsBefore: 0 })).toEqual(["reveal"]);
    expect(momentsForTap({ starsBefore: 8 })).toEqual(["reveal"]);
  });
  it("a new picture (3, 7, 12, 18 stars): the item's reveal first, then the milestone", () => {
    for (const starsBefore of [2, 6, 11, 17]) expect(momentsForTap({ starsBefore })).toEqual(["reveal", "milestone"]);
    expect(momentsForTap({ starsBefore: 18 })).toEqual(["reveal"]); // full bloom stays full bloom
  });
});

describe("timings: bigger and longer, with a minimum time on screen", () => {
  it("about 1.5 s big, then a 0.6 s flight; at least 0.8 s seen before anything cuts it", () => {
    expect(FLY_AT - SHOW_AT).toBe(1500);
    expect(LAND_AT - FLY_AT).toBe(600);
    expect(MIN_ON_SCREEN).toBe(800);
    // Measured from when it's drawn (a reveal draws nothing in its enter beat).
    expect(CUT_AT.reveal).toBe(SHOW_AT + MIN_ON_SCREEN);
    expect(CUT_AT.milestone).toBe(MIN_ON_SCREEN);
  });
});

type Data = { name: string };

function setup() {
  const phases: (string | null)[] = [];
  const landed: [string, boolean][] = [];
  const moments = createMoments<Data>({
    change: (m: Moment<Data> | null) => phases.push(m ? `${m.data.name}:${m.phase}` : null),
    land: (m, skipped) => landed.push([m.data.name, skipped]),
  });
  const play = (kind: MomentKind, name: string, instant = false) => moments.play([{ kind, data: { name }, instant }]);
  return { moments, play, phases, landed };
}

describe("createMoments: one big moment at a time, each seen, none lost", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("a reveal waits a beat, shows big, flies, then lands once", () => {
    const { moments, play, phases, landed } = setup();
    play("reveal", "a");
    expect(phases).toEqual(["a:enter"]);
    vi.advanceTimersByTime(SHOW_AT);
    expect(moments.current()?.phase).toBe("show");
    vi.advanceTimersByTime(FLY_AT - SHOW_AT);
    expect(moments.current()?.phase).toBe("fly");
    expect(landed).toEqual([]);
    vi.advanceTimersByTime(LAND_AT - FLY_AT);
    expect(phases).toEqual(["a:enter", "a:show", "a:fly", null]);
    expect(landed).toEqual([["a", false]]);
    expect(moments.current()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("a milestone stays big for its two seconds", () => {
    const { play, phases, landed } = setup();
    play("milestone", "m");
    vi.advanceTimersByTime(MILESTONE_MS - 1);
    expect(landed).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(phases).toEqual(["m:show", null]);
    expect(landed).toEqual([["m", false]]);
  });

  it("a tap before the minimum waits its turn: the first is seen for its minimum, then the next starts", () => {
    const { moments, play, phases, landed } = setup();
    play("reveal", "a");
    vi.advanceTimersByTime(200);
    play("reveal", "b"); // the tap counts at once; only the picture waits
    expect(landed).toEqual([]);
    expect(moments.current()?.data.name).toBe("a");
    vi.advanceTimersByTime(CUT_AT.reveal - 200 - 1);
    expect(landed).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(landed).toEqual([["a", true]]);
    expect(moments.current()).toMatchObject({ phase: "enter", data: { name: "b" } });
    // b, the last one, plays in full; nothing of a happens later.
    vi.advanceTimersByTime(LAND_AT);
    expect(landed).toEqual([
      ["a", true],
      ["b", false],
    ]);
    // No gap between them: straight from a to b.
    expect(phases).toEqual(["a:enter", "a:show", "b:enter", "b:show", "b:fly", null]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("a tap after the minimum lands the current one at once and starts", () => {
    const { moments, play, landed } = setup();
    play("reveal", "a");
    vi.advanceTimersByTime(CUT_AT.reveal + 300);
    play("reveal", "b");
    expect(landed).toEqual([["a", true]]);
    expect(moments.current()).toMatchObject({ phase: "enter", data: { name: "b" } });
  });

  it("one tap's reveal then milestone: the reveal plays in full, then the milestone, never both at once", () => {
    const { moments, phases, landed } = setup();
    moments.play([
      { kind: "reveal", data: { name: "r" } },
      { kind: "milestone", data: { name: "m" } },
    ]);
    vi.advanceTimersByTime(LAND_AT - 1);
    expect(landed).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(landed).toEqual([["r", false]]);
    expect(moments.current()).toMatchObject({ kind: "milestone", phase: "show" });
    vi.advanceTimersByTime(MILESTONE_MS);
    expect(landed).toEqual([
      ["r", false],
      ["m", false],
    ]);
    expect(phases).toEqual(["r:enter", "r:show", "r:fly", "m:show", null]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("a new tap during a reveal-then-milestone: each still gets its minimum, in order", () => {
    const { moments, play, landed } = setup();
    moments.play([
      { kind: "reveal", data: { name: "r" } },
      { kind: "milestone", data: { name: "m" } },
    ]);
    vi.advanceTimersByTime(300);
    play("reveal", "b");
    vi.advanceTimersByTime(CUT_AT.reveal - 300);
    expect(landed).toEqual([["r", true]]);
    expect(moments.current()?.data.name).toBe("m");
    vi.advanceTimersByTime(CUT_AT.milestone);
    expect(landed).toEqual([
      ["r", true],
      ["m", true],
    ]);
    expect(moments.current()?.data.name).toBe("b");
    vi.advanceTimersByTime(LAND_AT);
    expect(landed.at(-1)).toEqual(["b", false]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("several quick taps: each is seen for its minimum and lands exactly once, in order", () => {
    const { play, phases, landed } = setup();
    play("reveal", "a");
    vi.advanceTimersByTime(50);
    play("reveal", "b");
    vi.advanceTimersByTime(50);
    play("reveal", "c");
    play("reveal", "d");
    vi.advanceTimersByTime(CUT_AT.reveal - 100);
    expect(landed).toEqual([["a", true]]);
    vi.advanceTimersByTime(CUT_AT.reveal);
    expect(landed.map(([n]) => n)).toEqual(["a", "b"]);
    vi.advanceTimersByTime(10_000);
    expect(landed).toEqual([
      ["a", true],
      ["b", true],
      ["c", true],
      ["d", false],
    ]);
    // Each one was drawn (shown) before the next.
    expect(phases.filter((p) => p?.endsWith(":show"))).toEqual(["a:show", "b:show", "c:show", "d:show"]);
    expect(phases.filter((p) => p === null)).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("fast-forward (the page is hidden) lands what plays and everything waiting, in order", () => {
    const { moments, play, phases, landed } = setup();
    moments.fastForward();
    expect(phases).toEqual([]);
    play("reveal", "a");
    play("reveal", "b");
    moments.play([
      { kind: "reveal", data: { name: "c" } },
      { kind: "milestone", data: { name: "m" } },
    ]);
    vi.advanceTimersByTime(SHOW_AT);
    moments.fastForward();
    expect(landed).toEqual([
      ["a", true],
      ["b", true],
      ["c", true],
      ["m", true],
    ]);
    expect(phases.at(-1)).toBeNull();
    expect(moments.current()).toBeNull();
    moments.fastForward();
    expect(landed).toHaveLength(4);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("instant (Reduce Motion): it lands right away, with no phases", () => {
    const { moments, play, phases, landed } = setup();
    play("reveal", "a", true);
    expect(landed).toEqual([["a", false]]);
    expect(phases).toEqual([]);
    expect(moments.current()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("instant never waits: what plays and what waits land first, then it, and nothing is left showing", () => {
    const { play, phases, landed } = setup();
    play("milestone", "m");
    play("reveal", "q");
    vi.advanceTimersByTime(100);
    play("reveal", "b", true);
    expect(landed).toEqual([
      ["m", true],
      ["q", true],
      ["b", false],
    ]);
    expect(phases.at(-1)).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("dispose stops the timers and drops what waits, without landing; it can play again after", () => {
    const { moments, play, landed } = setup();
    play("reveal", "a");
    play("reveal", "w");
    moments.dispose();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(LAND_AT * 3);
    expect(landed).toEqual([]);
    play("reveal", "b");
    vi.advanceTimersByTime(LAND_AT);
    expect(landed).toEqual([["b", false]]);
  });
});
