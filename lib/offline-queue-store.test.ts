// lib/offline-queue-store.test.ts
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { createOfflineQueue, indexedDbStorage, memoryStorage, type Locks } from "./offline-queue-store";
import type { Sender } from "./offline-queue";

const fixedNow = () => new Date("2026-10-05T20:58:00.000Z");
const ids = () => {
  let n = 0;
  return () => `id-${++n}`;
};

// A stand-in for navigator.locks: one exclusive lock per name, shared by every "tab" given it.
function fakeLocks(): Locks {
  const tails = new Map<string, Promise<unknown>>();
  // Requests holding or waiting for each name (a request counts from the moment it is made).
  const busy = new Map<string, number>();
  return {
    request(name, options, callback) {
      if (options.ifAvailable && (busy.get(name) ?? 0) > 0) return callback(null);
      busy.set(name, (busy.get(name) ?? 0) + 1);
      const prev = tails.get(name) ?? Promise.resolve();
      const run = prev.then(async () => {
        try {
          return await callback({ name });
        } finally {
          busy.set(name, busy.get(name)! - 1);
        }
      });
      tails.set(name, run.catch(() => undefined));
      return run;
    },
  };
}

describe("IndexedDB storage", () => {
  it("keeps the queue across a reopen (app closed and opened)", async () => {
    const first = indexedDbStorage("test-reopen");
    await first.save([{ kind: "check_in", clientId: "a", habitId: "h1", subjectId: null, tappedAt: fixedNow().toISOString() }]);
    const reopened = indexedDbStorage("test-reopen");
    expect(await reopened.load()).toEqual([{ kind: "check_in", clientId: "a", habitId: "h1", subjectId: null, tappedAt: "2026-10-05T20:58:00.000Z" }]);
  });

  it("starts empty", async () => {
    expect(await indexedDbStorage("test-empty").load()).toEqual([]);
  });

  it("changes from two tabs at once both land", async () => {
    const a = indexedDbStorage("test-two-tabs");
    const b = indexedDbStorage("test-two-tabs");
    const entry = (clientId: string) => ({ kind: "check_in" as const, clientId, habitId: "h1", subjectId: null, tappedAt: "2026-10-05T20:58:00.000Z" });
    await Promise.all([a.update((q) => [...q, entry("a")]), b.update((q) => [...q, entry("b")])]);
    expect((await a.load()).map((e) => e.clientId).sort()).toEqual(["a", "b"]);
  });
});

describe("IndexedDB that won't open", () => {
  it("keeps the queue in memory instead of failing taps", async () => {
    const storage = indexedDbStorage("test-broken", () => Promise.reject(new Error("blocked")));
    await storage.update((q) => [...q, { kind: "undo", clientId: "a", habitId: "h1" }]);
    expect(await storage.load()).toEqual([{ kind: "undo", clientId: "a", habitId: "h1" }]);
  });
});

describe("createOfflineQueue", () => {
  it("a failed send's count is kept on the phone for the next flush", async () => {
    const storage = memoryStorage();
    const queue = createOfflineQueue({ storage, send: async () => "retry", now: fixedNow, newId: ids() });
    await queue.checkIn("h1");
    await queue.flush();
    await queue.flush();
    expect((await storage.load())[0].attempts).toBe(2);
  });

  it("forget removes a tap that reached the server online", async () => {
    const storage = memoryStorage();
    const queue = createOfflineQueue({ storage, send: async () => "retry", now: fixedNow, newId: ids() });
    const a = await queue.checkIn("h1");
    await queue.checkIn("h2");
    await queue.forget(a);
    expect((await storage.load()).map((e) => e.habitId)).toEqual(["h2"]);
  });

  it("records the tap time and a fresh clientId", async () => {
    const storage = memoryStorage();
    const queue = createOfflineQueue({ storage, send: async () => "retry", now: fixedNow, newId: ids() });
    expect(await queue.checkIn("h1")).toBe("id-1");
    expect(await storage.load()).toEqual([{ kind: "check_in", clientId: "id-1", habitId: "h1", subjectId: null, tappedAt: "2026-10-05T20:58:00.000Z" }]);
  });

  it("tells the UI which habits are saving, and clears after sync", async () => {
    const seen: string[][] = [];
    const queue = createOfflineQueue({ storage: memoryStorage(), send: async () => "synced", now: fixedNow, newId: ids(), onChange: (p) => seen.push([...p.keys()]) });
    await queue.checkIn("h1");
    await queue.flush();
    expect(seen).toEqual([["h1"], []]);
  });

  it("concurrent flush sends each entry once", async () => {
    let calls = 0;
    const send: Sender = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 5));
      return "synced";
    };
    const queue = createOfflineQueue({ storage: memoryStorage(), send, now: fixedNow, newId: ids() });
    await queue.checkIn("h1");
    await Promise.all([queue.flush(), queue.flush()]);
    expect(calls).toBe(1);
    expect(await queue.pending()).toEqual(new Set());
  });

  it("keeps the client id of a tap already tried online, and marks kid-view taps", async () => {
    const storage = memoryStorage();
    const queue = createOfflineQueue({ storage, send: async () => "retry", now: fixedNow, newId: ids() });
    expect(await queue.checkIn("h1", "kid1", { clientId: "tried-online", byChild: true })).toBe("tried-online");
    expect(await storage.load()).toEqual([
      { kind: "check_in", clientId: "tried-online", habitId: "h1", subjectId: "kid1", tappedAt: "2026-10-05T20:58:00.000Z", byChild: true },
    ]);
  });

  it("keeps the time of the tap, not the time it was queued", async () => {
    const storage = memoryStorage();
    const queue = createOfflineQueue({ storage, send: async () => "retry", now: fixedNow, newId: ids() });
    await queue.checkIn("h1", null, { clientId: "c1", tappedAt: "2026-10-05T20:57:30.000Z" });
    expect((await storage.load())[0]).toMatchObject({ clientId: "c1", tappedAt: "2026-10-05T20:57:30.000Z" });
  });

  it("a tap during a flush is not lost", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const send: Sender = async () => (await gate, "synced");
    const storage = memoryStorage();
    const queue = createOfflineQueue({ storage, send, now: fixedNow, newId: ids() });
    await queue.checkIn("h1");
    const running = queue.flush();
    await queue.checkIn("h2");
    release();
    await running;
    expect((await storage.load()).map((e) => e.habitId)).toEqual(["h2"]);
  });

  it("an undo during the flush that sends its check-in is kept for the next flush", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const sent: string[] = [];
    const send: Sender = async (e) => (await gate, sent.push(`${e.kind}:${e.clientId}`), "synced");
    const queue = createOfflineQueue({ storage: memoryStorage(), send, now: fixedNow, newId: ids() });
    const id = await queue.checkIn("h1");
    const running = queue.flush();
    await queue.undo(id, "h1");
    release();
    await running;
    await queue.flush();
    expect(sent).toEqual(["check_in:id-1", "undo:id-1"]);
  });

  it("a check-in queued again after its undo was sent is never sent", async () => {
    const sent: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const send: Sender = async (e) => (await gate, sent.push(`${e.kind}:${e.clientId}`), "synced");
    const storage = memoryStorage([{ kind: "undo", clientId: "a", habitId: "h1" }]);
    const queue = createOfflineQueue({ storage, send, now: fixedNow, newId: () => "a" });
    const running = queue.flush();
    await queue.checkIn("h1"); // the same tap, re-queued while its undo is on the way
    release();
    await running;
    expect(sent).toEqual(["undo:a"]);
    expect(await storage.load()).toEqual([]);
  });
});

describe("one sender across tabs (Web Locks)", () => {
  it("two tabs flushing at once send each entry once", async () => {
    const storage = memoryStorage();
    const locks = fakeLocks();
    const sent: string[] = [];
    const send: Sender = async (e) => {
      sent.push(e.clientId);
      await new Promise((r) => setTimeout(r, 5));
      return "synced";
    };
    const tabA = createOfflineQueue({ storage, send, now: fixedNow, newId: ids(), locks });
    const tabB = createOfflineQueue({ storage, send, now: fixedNow, newId: () => "b-1", locks });
    await tabA.checkIn("h1");
    await tabB.checkIn("h2");
    await Promise.all([tabA.flush(), tabB.flush()]);
    expect(sent).toEqual(["id-1", "b-1"]);
    expect(await storage.load()).toEqual([]);
  });

  it("an undo while another tab is sending is queued, not dropped", async () => {
    const storage = memoryStorage();
    const locks = fakeLocks();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const sent: string[] = [];
    const send: Sender = async (e) => (await gate, sent.push(`${e.kind}:${e.clientId}`), "synced");
    const tabA = createOfflineQueue({ storage, send, now: fixedNow, newId: ids(), locks });
    const tabB = createOfflineQueue({ storage, send, now: fixedNow, newId: ids(), locks });
    const id = await tabA.checkIn("h1");
    const running = tabA.flush();
    await tabB.undo(id, "h1");
    release();
    await running;
    await tabB.flush();
    expect(sent).toEqual(["check_in:id-1", "undo:id-1"]);
  });

  it("an undo with no tab sending removes the unsent check-in", async () => {
    const storage = memoryStorage();
    const queue = createOfflineQueue({ storage, send: async () => "synced", now: fixedNow, newId: ids(), locks: fakeLocks() });
    const id = await queue.checkIn("h1");
    await queue.undo(id, "h1");
    expect(await storage.load()).toEqual([]);
  });
});
