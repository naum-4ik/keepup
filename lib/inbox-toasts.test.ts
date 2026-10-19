import { describe, expect, it } from "vitest";
import { tEn, tFor } from "@/lib/i18n/test-t";
import { approvedAllText, reachServer, reviewedText } from "./inbox-toasts";

describe("reviewedText", () => {
  it("says what the decision does, with the names isolated", () => {
    expect(reviewedText(tEn, { name: "Alex", habit: "Gym", approve: true })).toBe("Approved: ⁨Alex⁩ · ⁨Gym⁩. It counts toward the streak.");
    expect(reviewedText(tEn, { name: "Alex", habit: "Gym", approve: false })).toBe("Not approved: ⁨Alex⁩ · ⁨Gym⁩. It won't count toward the streak.");
  });

  it("has ru and he lines", () => {
    for (const l of ["ru", "he"] as const) {
      const t = tFor(l);
      expect(reviewedText(t, { name: "Alex", habit: "Gym", approve: true })).toContain("⁨Alex⁩");
      expect(reviewedText(t, { name: "Alex", habit: "Gym", approve: false })).toContain("⁨Gym⁩");
    }
  });
});

describe("approvedAllText", () => {
  it("counts what was approved, and says when nothing was left", () => {
    expect(approvedAllText(tEn, 1)).toBe("Approved 1 check-in. It counts toward the streak.");
    expect(approvedAllText(tEn, 3)).toBe("Approved 3 check-ins. They count toward the streaks.");
    expect(approvedAllText(tEn, 0)).toBe("Nothing left to approve: someone reviewed them first.");
  });

  it("uses ru one/few/many and he one/two/other", () => {
    const ru = tFor("ru");
    expect(approvedAllText(ru, 1)).toContain("1 отметка");
    expect(approvedAllText(ru, 3)).toContain("3 отметки");
    expect(approvedAllText(ru, 5)).toContain("5 отметок");
    const he = tFor("he");
    expect(approvedAllText(he, 1)).not.toBe(approvedAllText(he, 2));
    expect(approvedAllText(he, 2)).toContain("2");
  });
});

describe("reachServer", () => {
  it("passes the server's answer through", async () => {
    expect(await reachServer(tEn, async () => ({ ok: true as const, reviewed: 1 }), () => true)).toEqual({ ok: true, reviewed: 1 });
  });

  it("offline: doesn't call, says to check the connection", async () => {
    let called = false;
    const r = await reachServer(tEn, async () => ((called = true), { ok: true }), () => false);
    expect(called).toBe(false);
    expect(r).toEqual({ ok: false, message: "Couldn't reach Keepup. Check your connection and tap again." });
  });

  it("a request that died: the same next step", async () => {
    const r = await reachServer(tEn, async () => Promise.reject(new Error("network")), () => true);
    expect(r).toEqual({ ok: false, message: "Couldn't reach Keepup. Check your connection and tap again." });
  });
});
