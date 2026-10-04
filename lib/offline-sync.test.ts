// lib/offline-sync.test.ts
import { describe, expect, it } from "vitest";
import { httpSender, isTap, newTap, outcomeFor, parseEntry, tapArgs, withQueuedTaps } from "./offline-sync";

const H = "00000000-0000-0000-0000-0000000000d1";
const C = "c0000000-0000-4000-8000-000000000001";
const K = "00000000-0000-0000-0000-0000000000f1";

describe("parseEntry", () => {
  it("accepts a check-in, a child's check-in and an undo", () => {
    expect(parseEntry({ kind: "check_in", clientId: C, habitId: H, subjectId: null, tappedAt: "2026-10-05T21:58:00.000Z" }))
      .toEqual({ kind: "check_in", clientId: C, habitId: H, subjectId: null, tappedAt: "2026-10-05T21:58:00.000Z" });
    expect(parseEntry({ kind: "check_in", clientId: C, habitId: H, subjectId: K, tappedAt: "2026-10-05T21:58:00Z", byChild: true }))
      .toEqual({ kind: "check_in", clientId: C, habitId: H, subjectId: K, tappedAt: "2026-10-05T21:58:00.000Z", byChild: true });
    expect(parseEntry({ kind: "undo", clientId: C, habitId: H })).toEqual({ kind: "undo", clientId: C, habitId: H });
  });

  it("refuses anything else", () => {
    expect(parseEntry(null)).toBeNull();
    expect(parseEntry({ kind: "check_in", clientId: "x", habitId: H, subjectId: null, tappedAt: "2026-10-05T21:58:00Z" })).toBeNull();
    expect(parseEntry({ kind: "check_in", clientId: C, habitId: H, subjectId: null, tappedAt: "yesterday" })).toBeNull();
    expect(parseEntry({ kind: "delete", clientId: C, habitId: H })).toBeNull();
  });
});

describe("outcomeFor", () => {
  it("synced, or dropped when the server kept nothing (too old)", () => {
    expect(outcomeFor(200, { outcome: "synced" })).toBe("synced");
    expect(outcomeFor(200, { outcome: "rejected" })).toBe("rejected");
  });

  it("a rule refusal is rejected, not retried (archived, period closed, already done)", () => {
    expect(outcomeFor(409, { error: "habit_archived" })).toBe("rejected");
    expect(outcomeFor(409, { error: "tap_in_future" })).toBe("rejected");
    expect(outcomeFor(400, { error: "bad_request" })).toBe("rejected");
  });

  it("a signed-out session or a server problem waits for the next try", () => {
    expect(outcomeFor(401, null)).toBe("retry");
    expect(outcomeFor(503, null)).toBe("retry");
    expect(outcomeFor(500, null)).toBe("retry");
  });
});

describe("httpSender", () => {
  it("posts the entry as JSON to the sync route", async () => {
    const calls: [string, RequestInit][] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return new Response(JSON.stringify({ outcome: "synced" }), { status: 200 });
    }) as unknown as typeof fetch;
    const entry = { kind: "undo" as const, clientId: C, habitId: H };
    expect(await httpSender(fake)(entry)).toBe("synced");
    expect(calls[0][0]).toBe("/api/check-ins/sync");
    expect(JSON.parse(String(calls[0][1].body))).toEqual(entry);
  });
});

describe("withQueuedTaps", () => {
  it("shows a queued tap as done until it syncs (the kid view keeps its star)", () => {
    const habits = [
      { id: "a", done: 0, target: 1, state: "open" },
      { id: "b", done: 1, target: 3, state: "open" },
      { id: "c", done: 1, target: 1, state: "done" },
    ];
    expect(withQueuedTaps(habits, new Map([["a", 1], ["b", 1], ["c", 1]]))).toEqual({
      habits: [
        { id: "a", done: 1, target: 1, state: "done" },
        { id: "b", done: 2, target: 3, state: "open" },
        { id: "c", done: 1, target: 1, state: "done" },
      ],
      added: 2,
    });
  });

  it("in the kid view, only the child's queued taps count", () => {
    const habits = [{ id: "a", done: 0, target: 1, state: "open" }];
    expect(withQueuedTaps(habits, new Map([["a", 1]]), "kid1").added).toBe(0);
    expect(withQueuedTaps(habits, new Map([["a/kid1", 1]]), "kid1").added).toBe(1);
  });

  it("two queued taps on a 3-a-day habit count twice, never past the target", () => {
    const habits = [
      { id: "b", done: 1, target: 3, state: "open" },
      { id: "d", done: 2, target: 3, state: "open" },
    ];
    expect(withQueuedTaps(habits, new Map([["b", 2], ["d", 2]]))).toEqual({
      habits: [
        { id: "b", done: 3, target: 3, state: "done" },
        { id: "d", done: 3, target: 3, state: "done" },
      ],
      added: 3,
    });
  });
});

describe("a tap's id and time", () => {
  it("every tap gets a fresh id and the time it was made", () => {
    const tap = newTap(new Date("2026-10-05T20:58:00.000Z"));
    expect(isTap(tap)).toBe(true);
    expect(tap.tappedAt).toBe("2026-10-05T20:58:00.000Z");
    expect(newTap().clientId).not.toBe(tap.clientId);
  });

  it("the server actions take none, or a valid one only", () => {
    expect(isTap(undefined)).toBe(true);
    expect(isTap({ clientId: C, tappedAt: "2026-10-05T20:58:00Z" })).toBe(true);
    expect(isTap({ clientId: "x", tappedAt: "2026-10-05T20:58:00Z" })).toBe(false);
    expect(isTap({ clientId: C, tappedAt: "soon" })).toBe(false);
    expect(isTap(null)).toBe(false);
    expect(tapArgs(undefined)).toEqual({});
    expect(tapArgs({ clientId: C, tappedAt: "2026-10-05T20:58:00Z" })).toEqual({ p_client_id: C, p_tapped_at: "2026-10-05T20:58:00.000Z" });
  });
});
