// lib/xp.test.ts
import { describe, expect, it } from "vitest";
import { countsNow, tapXp, xpLabel } from "./xp";

describe("tapXp", () => {
  it("an online tap floats what the server granted", () => {
    expect(tapXp({ queued: false, xp: 10 }, false)).toBe(10);
    expect(tapXp({ queued: false, xp: 17 }, false)).toBe(17);
    expect(tapXp({ queued: false }, false)).toBe(0);
    expect(tapXp({ queued: false }, true)).toBe(0);
  });
  it("counted, but the amount couldn't be read: +XP with no number", () => {
    expect(tapXp({ queued: false, xp: null }, false)).toBeNull();
  });
  it("a tap waiting on the phone floats +XP at once, with no number, unless the habit needs approval", () => {
    expect(tapXp({ queued: true }, false)).toBeNull();
    expect(tapXp({ queued: true }, true)).toBe(0);
  });
});

describe("xpLabel", () => {
  it("says the amount, or just +XP when it isn't known", () => {
    expect(xpLabel(10)).toBe("+10 XP");
    expect(xpLabel(30)).toBe("+30 XP");
    expect(xpLabel(null)).toBe("+XP");
  });
});

describe("countsNow", () => {
  const start = Date.parse("2026-10-05T10:00:00Z");
  const tap = { clientId: "c1" };
  const row = (o: Partial<{ status: string; client_id: string | null; created_at: string }> = {}) => ({
    status: "approved", client_id: "c1", created_at: "2026-10-05T10:00:00.050Z", ...o,
  });
  it("a row this request made: approved counts, pending doesn't yet", () => {
    expect(countsNow(row(), tap, start)).toBe(true);
    expect(countsNow(row({ status: "pending" }), tap, start)).toBe(false);
  });
  it("no row (a dropped too-old tap) doesn't", () => {
    expect(countsNow(null, tap, start)).toBe(false);
  });
  it("a resend of the same tap returns the earlier row: doesn't", () => {
    expect(countsNow(row({ created_at: "2026-10-05T09:59:56Z" }), tap, start)).toBe(false);
  });
  it("allows the app's clock to run a little ahead of the database's", () => {
    expect(countsNow(row({ created_at: "2026-10-05T09:59:58.500Z" }), tap, start)).toBe(true);
  });
  it("another tap's row (a quiet merge) doesn't", () => {
    expect(countsNow(row({ client_id: "other" }), tap, start)).toBe(false);
  });
});
