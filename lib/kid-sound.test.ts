import { describe, expect, it } from "vitest";
import { allowSound } from "@/lib/kid-sound";

describe("kid sounds", () => {
  it("lets a few sounds a second through, so tapping the scene can't turn into noise", () => {
    const times: number[] = [];
    const played = [0, 50, 100, 150, 200, 250, 300].filter((t) => allowSound(times, t, 4));
    expect(played).toEqual([0, 50, 100, 150]);
    expect(allowSound(times, 1100, 4)).toBe(true); // a second later, again
  });
});
