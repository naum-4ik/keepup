// lib/offline-queue.test.ts
import { describe, expect, it, vi } from "vitest";
import { addCheckIn, addUndo, flush, MAX_ATTEMPTS, pendingCounts, pendingHabitIds, queueKey, type QueueEntry, type QueuedCheckIn, type Sender } from "./offline-queue";

const tap = (clientId: string, habitId = "h1"): QueuedCheckIn => ({
  kind: "check_in",
  clientId,
  habitId,
  subjectId: null,
  tappedAt: "2026-10-05T20:58:00.000Z",
});

describe("adding to the queue", () => {
  it("appends check-ins in order and ignores a repeated clientId", () => {
    let q: QueueEntry[] = [];
    q = addCheckIn(q, tap("a"));
    q = addCheckIn(q, tap("b"));
    q = addCheckIn(q, tap("a"));
    expect(q.map((e) => e.clientId)).toEqual(["a", "b"]);
  });

  it("undo of an unsent check-in removes it and sends nothing", () => {
    const q = addUndo(addCheckIn([], tap("a")), { kind: "undo", clientId: "a", habitId: "h1" });
    expect(q).toEqual([]);
  });

  it("undo while that check-in is being sent: it leaves the queue (shows open) and an undo is queued", () => {
    const q = addUndo(addCheckIn([], tap("a")), { kind: "undo", clientId: "a", habitId: "h1" }, new Set(["a"]));
    expect(q.map((e) => `${e.kind}:${e.clientId}`)).toEqual(["undo:a"]);
  });

  it("undo of a check-in the server may have (maybe sent) asks the server; a never-tried one is just dropped", () => {
    const sent = addUndo(addCheckIn([], { ...tap("a"), maybeSent: true }), { kind: "undo", clientId: "a", habitId: "h1" });
    expect(sent.map((e) => `${e.kind}:${e.clientId}`)).toEqual(["undo:a"]);
    expect(pendingCounts(sent).size).toBe(0);
    expect(addUndo(addCheckIn([], tap("a")), { kind: "undo", clientId: "a", habitId: "h1" })).toEqual([]);
  });

  it("undo of an already-synced check-in is queued once", () => {
    let q = addUndo([], { kind: "undo", clientId: "a", habitId: "h1" });
    q = addUndo(q, { kind: "undo", clientId: "a", habitId: "h1" });
    expect(q).toEqual([{ kind: "undo", clientId: "a", habitId: "h1" }]);
  });

  it("reports which habits are still saving", () => {
    const q = addCheckIn(addCheckIn([], tap("a", "h1")), tap("b", "h2"));
    expect(pendingHabitIds(q)).toEqual(new Set(["h1", "h2"]));
    expect(pendingHabitIds([])).toEqual(new Set());
  });

  it("counts queued check-ins per habit and person, undos not included", () => {
    const q: QueueEntry[] = [
      tap("a", "h1"), tap("b", "h1"), tap("c", "h2"), { ...tap("d", "h2"), subjectId: "kid1" },
      { kind: "undo", clientId: "z", habitId: "h3" },
    ];
    expect(pendingCounts(q)).toEqual(new Map([["h1", 2], ["h2", 1], [queueKey("h2", "kid1"), 1]]));
    expect(queueKey("h2", "kid1")).not.toBe(queueKey("h2"));
  });
});

describe("flush", () => {
  it("sends in order and empties the queue when all sync", async () => {
    const sent: string[] = [];
    const send: Sender = async (e) => (sent.push(`${e.kind}:${e.clientId}`), "synced");
    const q = addUndo(addCheckIn([], tap("a")), { kind: "undo", clientId: "z", habitId: "h1" });
    const result = await flush(q, send);
    expect(sent).toEqual(["check_in:a", "undo:z"]);
    expect(result.remaining).toEqual([]);
    expect(result.synced.map((e) => e.clientId)).toEqual(["a", "z"]);
  });

  it("drops rejected entries and keeps going", async () => {
    const send: Sender = async (e) => (e.clientId === "a" ? "rejected" : "synced");
    const result = await flush([tap("a"), tap("b")], send);
    expect(result.rejected.map((e) => e.clientId)).toEqual(["a"]);
    expect(result.synced.map((e) => e.clientId)).toEqual(["b"]);
    expect(result.remaining).toEqual([]);
  });

  it("stops at the first retry and keeps the rest in order", async () => {
    const send = vi.fn<Sender>(async (e) => (e.clientId === "b" ? "retry" : "synced"));
    const result = await flush([tap("a"), tap("b"), tap("c")], send);
    expect(send).toHaveBeenCalledTimes(2);
    expect(result.remaining.map((e) => e.clientId)).toEqual(["b", "c"]);
  });

  it("treats a thrown error (no network) as retry", async () => {
    const send: Sender = async () => {
      throw new TypeError("Failed to fetch");
    };
    const result = await flush([tap("a")], send);
    expect(result.remaining.map((e) => e.clientId)).toEqual(["a"]);
    expect(result.synced).toEqual([]);
  });

  it("never sends a check-in again after its undo reached the server", async () => {
    const sent: string[] = [];
    const send: Sender = async (e) => (sent.push(`${e.kind}:${e.clientId}`), e.kind === "undo" ? "rejected" : "synced");
    const q: QueueEntry[] = [tap("a"), { kind: "undo", clientId: "a", habitId: "h1" }, tap("a"), tap("b")];
    const result = await flush(q, send);
    expect(sent).toEqual(["check_in:a", "undo:a", "check_in:b"]);
    expect(result.dropped.map((e) => `${e.kind}:${e.clientId}`)).toEqual(["check_in:a"]);
    expect(result.remaining).toEqual([]);
  });

  it("a retry counts against the entry and stops there; no network doesn't count", async () => {
    const retry = await flush([tap("a"), tap("b")], async () => "retry");
    expect(retry.attempted).toMatchObject({ clientId: "a", attempts: 1 });
    expect(retry.remaining.map((e) => [e.clientId, e.attempts])).toEqual([["a", 1], ["b", undefined]]);
    const offline = await flush([{ ...tap("a"), attempts: 2 }], async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(offline.attempted).toBeNull();
    expect(offline.remaining[0].attempts).toBe(2);
  });

  it(`an entry is given up only after ${MAX_ATTEMPTS} counted failures over more than a day; the flush goes on past it`, async () => {
    const sent: string[] = [];
    const send: Sender = async (e) => (sent.push(e.clientId), e.clientId === "a" ? "retry" : "synced");
    const now = () => new Date("2026-10-06T22:00:00.000Z");
    const recent = await flush([{ ...tap("a"), attempts: MAX_ATTEMPTS - 1, firstFailedAt: "2026-10-06T21:59:15.000Z" }, tap("b")], send, now);
    expect(recent.poisoned).toEqual([]);
    expect(recent.remaining[0]).toMatchObject({ clientId: "a", attempts: MAX_ATTEMPTS });
    const old = await flush([{ ...tap("a"), attempts: MAX_ATTEMPTS - 1, firstFailedAt: "2026-10-05T21:00:00.000Z" }, tap("b")], send, now);
    expect(old.poisoned.map((e) => e.clientId)).toEqual(["a"]);
    expect(old.synced.map((e) => e.clientId)).toEqual(["b"]);
    expect(old.remaining).toEqual([]);
  });

  it("the first counted failure's time is kept; a wait (timeout, expired session) changes nothing", async () => {
    const now = () => new Date("2026-10-06T22:00:00.000Z");
    const first = await flush([tap("a")], async () => "retry", now);
    expect(first.attempted).toMatchObject({ attempts: 1, firstFailedAt: "2026-10-06T22:00:00.000Z" });
    const waited = await flush([{ ...tap("a"), attempts: 4, firstFailedAt: "2026-10-01T00:00:00.000Z" }], async () => "wait", now);
    expect(waited.attempted).toBeNull();
    expect(waited.poisoned).toEqual([]);
    expect(waited.remaining[0]).toMatchObject({ attempts: 4 });
  });
});
