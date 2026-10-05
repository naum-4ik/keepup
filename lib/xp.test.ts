// lib/xp.test.ts
import { describe, expect, it } from "vitest";
import { checkInXp, tapXp } from "./xp";

describe("checkInXp", () => {
  it("only a counted check-in earns XP right away", () => {
    expect(checkInXp("approved")).toBe(10);
  });
  it("one waiting for approval, or none at all (a dropped offline tap), shows nothing", () => {
    expect(checkInXp("pending")).toBe(0);
    expect(checkInXp(null)).toBe(0);
    expect(checkInXp(undefined)).toBe(0);
  });
});

describe("tapXp", () => {
  it("an online tap floats what the server counted", () => {
    expect(tapXp({ queued: false, xp: 10 }, false)).toBe(10);
    expect(tapXp({ queued: false }, false)).toBe(0);
    expect(tapXp({ queued: false }, true)).toBe(0);
  });
  it("a tap waiting on the phone floats at once, unless the habit needs approval", () => {
    expect(tapXp({ queued: true }, false)).toBe(10);
    expect(tapXp({ queued: true }, true)).toBe(0);
  });
});
