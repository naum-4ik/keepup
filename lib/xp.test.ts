// lib/xp.test.ts
import { describe, expect, it } from "vitest";
import { checkInRowXp, checkInXp, tapXp } from "./xp";

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

describe("checkInRowXp", () => {
  const start = Date.parse("2026-10-05T10:00:00Z");
  const tap = { clientId: "c1" };
  const row = (o: Partial<{ status: string; client_id: string | null; created_at: string }> = {}) => ({
    status: "approved", client_id: "c1", created_at: "2026-10-05T10:00:00.050Z", ...o,
  });
  it("a row this request made: approved earns 10, pending nothing", () => {
    expect(checkInRowXp(row(), tap, start)).toBe(10);
    expect(checkInRowXp(row({ status: "pending" }), tap, start)).toBe(0);
  });
  it("no row (a dropped too-old tap) earns nothing", () => {
    expect(checkInRowXp(null, tap, start)).toBe(0);
  });
  it("a resend of the same tap returns the earlier row: nothing", () => {
    expect(checkInRowXp(row({ created_at: "2026-10-05T09:59:56Z" }), tap, start)).toBe(0);
  });
  it("allows the app's clock to run a little ahead of the database's", () => {
    expect(checkInRowXp(row({ created_at: "2026-10-05T09:59:58.500Z" }), tap, start)).toBe(10);
  });
  it("another tap's row (a quiet merge) earns nothing", () => {
    expect(checkInRowXp(row({ client_id: "other" }), tap, start)).toBe(0);
  });
});
