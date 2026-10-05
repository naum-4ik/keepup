import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMoments, FLY_AT, kindOfTap, LAND_AT, MILESTONE_MS, SHOW_AT, type Moment } from "@/lib/kid-reveal";

describe("kindOfTap: reveal, milestone or the small effect", () => {
  it("a tap that finishes the habit is a big reveal", () => {
    expect(kindOfTap({ starsBefore: 0, done: 0, target: 1 })).toBe("reveal");
    expect(kindOfTap({ starsBefore: 4, done: 1, target: 2 })).toBe("reveal");
  });
  it("part of a 2×-a-day habit keeps the small effect", () => {
    expect(kindOfTap({ starsBefore: 0, done: 0, target: 2 })).toBe("partial");
  });
  it("a new picture (3, 7, 12, 18 stars) is the milestone, even when the tap also finishes the habit", () => {
    expect(kindOfTap({ starsBefore: 2, done: 0, target: 1 })).toBe("milestone");
    expect(kindOfTap({ starsBefore: 6, done: 0, target: 2 })).toBe("milestone");
    expect(kindOfTap({ starsBefore: 17, done: 1, target: 2 })).toBe("milestone");
    expect(kindOfTap({ starsBefore: 18, done: 0, target: 1 })).toBe("reveal"); // full bloom stays full bloom
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
  return { moments, phases, landed };
}

describe("createMoments: one big moment at a time, never in the way of the next tap", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("a reveal waits a beat, shows big, flies, then lands once", () => {
    const { moments, phases, landed } = setup();
    moments.play("reveal", { name: "a" });
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
    const { moments, phases, landed } = setup();
    moments.play("milestone", { name: "m" });
    vi.advanceTimersByTime(MILESTONE_MS - 1);
    expect(landed).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(phases).toEqual(["m:show", null]);
    expect(landed).toEqual([["m", false]]);
  });

  it("a new tap mid-reveal lands the current one at once, then starts the next", () => {
    const { moments, phases, landed } = setup();
    moments.play("reveal", { name: "a" });
    vi.advanceTimersByTime(500);
    moments.play("reveal", { name: "b" });
    expect(landed).toEqual([["a", true]]);
    expect(moments.current()).toMatchObject({ phase: "enter", data: { name: "b" } });
    // a's old timers are gone: nothing of a happens later.
    vi.advanceTimersByTime(LAND_AT);
    expect(landed).toEqual([
      ["a", true],
      ["b", false],
    ]);
    expect(phases).toEqual(["a:enter", "a:show", "b:enter", "b:show", "b:fly", null]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("several quick taps land in order, each exactly once", () => {
    const { moments, landed } = setup();
    moments.play("reveal", { name: "a" });
    vi.advanceTimersByTime(50);
    moments.play("reveal", { name: "b" });
    vi.advanceTimersByTime(FLY_AT + 10); // b is flying
    moments.play("milestone", { name: "c" });
    moments.play("reveal", { name: "d" });
    vi.advanceTimersByTime(10_000);
    expect(landed).toEqual([
      ["a", true],
      ["b", true],
      ["c", true],
      ["d", false],
    ]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("fast-forward lands what plays (a partial tap starts nothing of its own); with nothing playing it does nothing", () => {
    const { moments, phases, landed } = setup();
    moments.fastForward();
    expect(phases).toEqual([]);
    moments.play("reveal", { name: "a" });
    vi.advanceTimersByTime(SHOW_AT);
    moments.fastForward();
    expect(landed).toEqual([["a", true]]);
    expect(phases.at(-1)).toBeNull();
    moments.fastForward();
    expect(landed).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("instant (Reduce Motion): it lands right away, with no phases", () => {
    const { moments, phases, landed } = setup();
    moments.play("reveal", { name: "a" }, { instant: true });
    expect(landed).toEqual([["a", false]]);
    expect(phases).toEqual([]);
    expect(moments.current()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("instant after a playing one: that one lands first, and nothing is left showing", () => {
    const { moments, phases, landed } = setup();
    moments.play("reveal", { name: "a" });
    vi.advanceTimersByTime(SHOW_AT);
    moments.play("reveal", { name: "b" }, { instant: true });
    expect(landed).toEqual([
      ["a", true],
      ["b", false],
    ]);
    expect(phases.at(-1)).toBeNull();
  });

  it("dispose stops the timers without landing, and it can play again after", () => {
    const { moments, landed } = setup();
    moments.play("reveal", { name: "a" });
    moments.dispose();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(LAND_AT);
    expect(landed).toEqual([]);
    moments.play("reveal", { name: "b" });
    vi.advanceTimersByTime(LAND_AT);
    expect(landed).toEqual([["b", false]]);
  });
});
