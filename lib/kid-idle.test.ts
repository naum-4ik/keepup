import { describe, expect, it } from "vitest";
import { KID_THEMES } from "@/lib/garden";
import { DRIFT_EVERY, drifterFor, idleMotion, nextDelay, SPARKLE_EVERY } from "@/lib/kid-idle";
import { MAX_ITEMS } from "@/lib/scene-items";

describe("idle motion: calm, slow and never a stage picture", () => {
  it("waits 8–12 s between sparkles and 20–30 s between drifts", () => {
    expect(nextDelay(SPARKLE_EVERY, () => 0)).toBe(8_000);
    expect(nextDelay(SPARKLE_EVERY, () => 0.5)).toBe(10_000);
    expect(nextDelay(SPARKLE_EVERY, () => 0.9999)).toBeLessThanOrEqual(12_000);
    expect(nextDelay(DRIFT_EVERY, () => 0)).toBe(20_000);
    expect(nextDelay(DRIFT_EVERY, () => 1)).toBe(30_000);
    expect(nextDelay(DRIFT_EVERY, () => 7)).toBe(30_000); // clamped
  });
  it("drifts something of the theme's own that is never one of its stage pictures", () => {
    for (const t of KID_THEMES) {
      expect(t.stages.map((s) => s.icon), t.id).not.toContain(drifterFor(t.id));
    }
    expect(drifterFor(null)).toBe(drifterFor("garden"));
  });
  it("gives each item a slow 3–6 s cycle, with items out of step", () => {
    const motions = Array.from({ length: MAX_ITEMS }, (_, i) => idleMotion(i));
    for (const m of motions) {
      expect(m.seconds).toBeGreaterThanOrEqual(3);
      expect(m.seconds).toBeLessThanOrEqual(6);
      expect(m.delay).toBeLessThanOrEqual(0);
    }
    expect(new Set(motions.slice(0, 6).map((m) => `${m.seconds}/${m.delay}`)).size).toBe(6);
    expect(idleMotion(4)).toEqual(idleMotion(4));
  });
});
