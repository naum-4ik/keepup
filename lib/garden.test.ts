import { describe, expect, it } from "vitest";
import { stageFor, starsToNext } from "@/lib/garden";

describe("garden", () => {
  it("grows at 0/3/7/12/18 stars (same as private.garden_stage)", () => {
    expect([0, 2, 3, 6, 7, 11, 12, 17, 18, 40].map(stageFor)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
  it("says how many stars to the next picture", () => {
    expect(starsToNext(0)).toBe(3);
    expect(starsToNext(8)).toBe(4);
    expect(starsToNext(18)).toBeNull();
  });
});
