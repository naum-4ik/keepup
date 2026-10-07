// lib/offline-sync.test.ts
import { describe, expect, it, vi } from "vitest";
import { httpSender, newTap, outcomeFor, parseEntry, parseTap, tapAnswer, tapSender, withQueuedTaps } from "./offline-sync";

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

  it("a 200 that isn't the sync route's answer (a captive portal) is tried again, never synced", () => {
    expect(outcomeFor(200, null)).toBe("retry");
    expect(outcomeFor(200, { ok: true })).toBe("retry");
    expect(outcomeFor(200, "<html>Log in to the Wi-Fi</html>")).toBe("retry");
  });

  it("403, 405 and 413 can never succeed: dropped, not retried", () => {
    expect(outcomeFor(403, { error: "forbidden" })).toBe("rejected");
    expect(outcomeFor(405, null)).toBe("rejected");
    expect(outcomeFor(413, { error: "too_large" })).toBe("rejected");
  });

  it("a rule refusal is rejected, not retried (archived, period closed, already done)", () => {
    expect(outcomeFor(409, { error: "habit_archived" })).toBe("rejected");
    expect(outcomeFor(409, { error: "tap_in_future" })).toBe("rejected");
    expect(outcomeFor(400, { error: "bad_request" })).toBe("rejected");
  });

  it("an expired session waits (not counted); a server problem is a counted retry", () => {
    expect(outcomeFor(401, null)).toBe("wait");
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

  it("keeps the phone's bookkeeping (attempts, maybe sent) on the phone", async () => {
    let body = "";
    const fake = (async (_url: string, init: RequestInit) => {
      body = String(init.body);
      return new Response(JSON.stringify({ outcome: "synced" }), { status: 200 });
    }) as unknown as typeof fetch;
    const tap = { kind: "check_in" as const, clientId: C, habitId: H, subjectId: null, tappedAt: "2026-10-05T21:58:00.000Z" };
    await httpSender(fake)({ ...tap, maybeSent: true, attempts: 2, firstFailedAt: "2026-10-05T22:00:00.000Z" });
    expect(JSON.parse(body)).toEqual(tap);
  });

  it("keeps the attempt count on the phone", async () => {
    let body = "";
    const fake = (async (_url: string, init: RequestInit) => ((body = String(init.body)), new Response(JSON.stringify({ outcome: "synced" })))) as unknown as typeof fetch;
    await httpSender(fake)({ kind: "undo", clientId: C, habitId: H, subjectId: null, queuedAt: "2026-10-05T22:00:00.000Z", attempts: 3 });
    expect(JSON.parse(body)).toEqual({ kind: "undo", clientId: C, habitId: H });
  });

  it("a request that hangs is given up and waits (not counted); no network throws", async () => {
    const hang = ((_url: string, init: RequestInit) =>
      new Promise((_, reject) => init.signal!.addEventListener("abort", () => reject(init.signal!.reason)))) as unknown as typeof fetch;
    expect(await httpSender(hang, 20)({ kind: "undo", clientId: C, habitId: H })).toBe("wait");
    const offline = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    await expect(httpSender(offline)({ kind: "undo", clientId: C, habitId: H })).rejects.toThrow("Failed to fetch");
  });
});

describe("withQueuedTaps", () => {
  it("a waiting undo of a counted tap takes it back (the card is open again), never below zero", () => {
    const habits = [
      { id: "a", done: 1, target: 1, state: "done" },
      { id: "b", done: 0, target: 1, state: "open" },
    ];
    expect(withQueuedTaps(habits, new Map([["a/kid1", -1], ["b/kid1", -1]]), "kid1")).toEqual({
      habits: [
        { id: "a", done: 0, target: 1, state: "open" },
        { id: "b", done: 0, target: 1, state: "open" },
      ],
      added: -1,
    });
  });

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
    expect(tap.tappedAt).toBe("2026-10-05T20:58:00.000Z");
    expect(newTap().clientId).not.toBe(tap.clientId);
  });
});

describe("an online tap (app/api/check-ins/tap)", () => {
  it("the route takes a tap's id, habit and whose it is; nothing else counts", () => {
    expect(parseTap({ clientId: C, habitId: H, subjectId: null })).toEqual({ clientId: C, habitId: H, subjectId: null });
    expect(parseTap({ clientId: C, habitId: H })).toEqual({ clientId: C, habitId: H, subjectId: null });
    expect(parseTap({ clientId: C, habitId: H, subjectId: C, byChild: true, tappedAt: "2026-10-05T20:58:00Z" })).toEqual({
      clientId: C, habitId: H, subjectId: C, byChild: true,
    });
    expect(parseTap({ clientId: "x", habitId: H })).toBeNull();
    expect(parseTap({ clientId: C, habitId: H, subjectId: "kid" })).toBeNull();
    expect(parseTap(null)).toBeNull();
  });

  it("reads the answer: counted with its XP, a rule's refusal (final), or something that keeps it queued", () => {
    expect(tapAnswer(200, { xp: 12 })).toEqual({ ok: true, xp: 12 });
    expect(tapAnswer(200, { xp: null })).toEqual({ ok: true, xp: null });
    expect(tapAnswer(409, { code: "habit_frozen", message: "This habit is paused." })).toEqual({ ok: false, message: "This habit is paused.", code: "habit_frozen" });
    expect(tapAnswer(401, { code: "not_authenticated" })).toMatchObject({ ok: false, code: "not_authenticated" });
    // A captive portal's 200 page, a server problem: no code.
    expect(tapAnswer(200, null)).toEqual({ ok: false, message: expect.any(String) });
    expect(tapAnswer(503, { message: "Something went wrong. Try again." })).toEqual({ ok: false, message: "Something went wrong. Try again." });
  });

  it("posts the tap without a time, and passes the abort signal on", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ xp: 10 }), { status: 200 }));
    const abort = new AbortController();
    expect(await tapSender(fetchImpl as unknown as typeof fetch)({ clientId: C, habitId: H, subjectId: null }, abort.signal)).toEqual({ ok: true, xp: 10 });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/check-ins/tap");
    expect(JSON.parse(init.body as string)).toEqual({ clientId: C, habitId: H, subjectId: null });
    expect(init.signal).toBe(abort.signal);
  });
});
