import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOfflineClient, type Channel, type Flushed } from "./offline-client";
import { memoryStorage } from "./offline-queue-store";
import type { Sender } from "./offline-queue";

function setup(o: { send?: Sender; online?: boolean; channel?: Channel; tapTimeoutMs?: number } = {}) {
  const storage = memoryStorage();
  let online = o.online ?? true;
  const counts: string[][] = [];
  const flushed: Flushed[] = [];
  const client = createOfflineClient({
    storage,
    send: o.send ?? (async () => "synced"),
    isOnline: () => online,
    onCounts: (c) => counts.push([...c.keys()]),
    onFlushed: (f) => flushed.push(f),
    channel: o.channel,
    tapTimeoutMs: o.tapTimeoutMs,
  });
  return { storage, client, counts, flushed, setOnline: (v: boolean) => void (online = v) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("an online tap", () => {
  it("is saved on the phone before it is tried, sent with its id only, and leaves the queue once it lands", async () => {
    const { client, storage } = setup();
    let release!: (v: { ok: true }) => void;
    const action = vi.fn(() => new Promise<{ ok: true }>((r) => (release = r)));
    const done = client.submitTap({ habitId: "h1" }, action);
    await vi.waitFor(() => expect(action).toHaveBeenCalled());
    // Closing the app now would lose nothing: the tap is already queued, with its tap time.
    expect(await storage.load()).toMatchObject([{ kind: "check_in", habitId: "h1", tappedAt: expect.any(String) }]);
    const sent = (action.mock.calls[0] as unknown as [{ clientId: string }])[0];
    expect(Object.keys(sent)).toEqual(["clientId"]);
    release({ ok: true });
    expect(await done).toEqual({ ok: true, queued: false });
    expect(await storage.load()).toEqual([]);
  });

  it("a rule refusal (a keepup: code) says why and leaves nothing queued", async () => {
    const { client, storage } = setup();
    expect(await client.submitTap({ habitId: "h1" }, async () => ({ ok: false, message: "This habit is paused.", code: "habit_frozen" }))).toEqual({
      ok: false, message: "This habit is paused.",
    });
    expect(await storage.load()).toEqual([]);
  });

  it("an error without a rule, or an expired session, keeps it queued and schedules a flush", async () => {
    const sent: string[] = [];
    const { client, storage } = setup({ send: async (e) => (sent.push(e.clientId), "synced") });
    expect(await client.submitTap({ habitId: "h1" }, async () => ({ ok: false, message: "Something went wrong. Try again." }))).toEqual({ ok: true, queued: true });
    expect(await client.submitTap({ habitId: "h2" }, async () => ({ ok: false, message: "Please sign in again.", code: "not_authenticated" }))).toEqual({ ok: true, queued: true });
    expect((await storage.load()).map((e) => e.habitId)).toEqual(["h1", "h2"]);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(sent).toHaveLength(2);
    expect(await storage.load()).toEqual([]);
  });

  it("no answer: it stays queued under the same id, and a flush is tried a few seconds later", async () => {
    const sent: string[] = [];
    const { client, storage } = setup({ send: async (e) => (sent.push(e.clientId), "synced") });
    expect(await client.submitTap({ habitId: "h1" }, async () => Promise.reject(new TypeError("Failed to fetch")))).toEqual({ ok: true, queued: true });
    const [entry] = await storage.load();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(sent).toEqual([entry.clientId]);
    expect(await storage.load()).toEqual([]);
  });

  it("a request that hangs is left to the queue after the timeout", async () => {
    const { client, storage } = setup({ tapTimeoutMs: 50 });
    const done = client.submitTap({ habitId: "h1" }, () => new Promise(() => {}));
    await vi.advanceTimersByTimeAsync(50);
    expect(await done).toEqual({ ok: true, queued: true });
    expect(await storage.load()).toHaveLength(1);
  });

  it("offline: queued without trying", async () => {
    const { client, storage } = setup({ online: false });
    const action = vi.fn();
    expect(await client.submitTap({ habitId: "h1", subjectId: "kid1", byChild: true }, action)).toEqual({ ok: true, queued: true });
    expect(action).not.toHaveBeenCalled();
    expect(await storage.load()).toMatchObject([{ habitId: "h1", subjectId: "kid1", byChild: true }]);
  });
});

describe("flush and the UI", () => {
  it("holds its changes back and hands them over once, with whether the page should refresh", async () => {
    const { client, counts, flushed, setOnline } = setup();
    setOnline(false);
    await client.submitTap({ habitId: "h1" }, vi.fn());
    expect(counts).toEqual([["h1"]]);
    setOnline(true);
    await client.flush();
    expect(counts).toEqual([["h1"]]); // nothing in between
    expect(flushed).toEqual([{ counts: new Map(), changed: true, poisoned: 0 }]);
  });

  it("does nothing offline", async () => {
    const { client, flushed } = setup({ online: false });
    expect(await client.flush()).toBeNull();
    expect(flushed).toEqual([]);
  });

  it("a 45-second outage drops nothing: it backs off and sends once the server is back", async () => {
    vi.setSystemTime(new Date("2026-10-06T22:00:00.000Z"));
    let down = true;
    const send = vi.fn<Sender>(async () => (down ? "retry" : "synced"));
    const { client, flushed, setOnline, storage } = setup({ send });
    setOnline(false);
    await client.submitTap({ habitId: "h1" }, vi.fn());
    setOnline(true);
    await client.flush();
    await vi.advanceTimersByTimeAsync(45_000);
    down = false;
    await vi.advanceTimersByTimeAsync(300_000);
    expect(await storage.load()).toEqual([]);
    expect(flushed.every((f) => f.poisoned === 0)).toBe(true);
    expect(send.mock.results.length).toBeGreaterThan(3);
  });

  it("backs off 3 s, 9 s, 30 s, then every 5 minutes", async () => {
    const send = vi.fn<Sender>(async () => "retry");
    const { client, setOnline } = setup({ send });
    setOnline(false);
    await client.submitTap({ habitId: "h1" }, vi.fn());
    setOnline(true);
    await client.flush();
    for (const [ms, calls] of [[3_000, 2], [9_000, 3], [30_000, 4], [300_000, 5], [300_000, 6]] as const) {
      await vi.advanceTimersByTimeAsync(ms - 1);
      expect(send).toHaveBeenCalledTimes(calls - 1);
      await vi.advanceTimersByTimeAsync(1);
      expect(send).toHaveBeenCalledTimes(calls);
    }
  });

  it("5 failures over 25 hours: the entry is given up and the UI is told", async () => {
    vi.setSystemTime(new Date("2026-10-06T00:00:00.000Z"));
    const send = vi.fn<Sender>(async () => "retry");
    const { client, flushed, setOnline, storage } = setup({ send });
    setOnline(false);
    await client.submitTap({ habitId: "h1" }, vi.fn());
    setOnline(true);
    for (let i = 0; i < 4; i++) {
      await client.flush();
      vi.setSystemTime(Date.now() + 6 * 60 * 60 * 1000); // the app opened again, hours later
    }
    vi.setSystemTime(new Date("2026-10-07T01:00:00.000Z"));
    await client.flush(); // the 5th, 25 h after the first
    expect(await storage.load()).toEqual([]);
    expect(flushed.at(-1)).toMatchObject({ poisoned: 1, changed: true });
  });

  it("timeouts never drop an entry", async () => {
    vi.setSystemTime(new Date("2026-10-06T00:00:00.000Z"));
    const { client, flushed, setOnline, storage } = setup({ send: async () => "wait" });
    setOnline(false);
    await client.submitTap({ habitId: "h1" }, vi.fn());
    setOnline(true);
    for (let i = 0; i < 10; i++) {
      await client.flush();
      vi.setSystemTime(Date.now() + 6 * 60 * 60 * 1000);
    }
    expect(await storage.load()).toHaveLength(1);
    expect((await storage.load())[0].attempts).toBeUndefined();
    expect(flushed.every((f) => f.poisoned === 0)).toBe(true);
  });

  it("tells other tabs, and refreshes when another tab sent what this one shows as waiting", async () => {
    let onMessage = () => {};
    const post = vi.fn();
    const channel: Channel = { post, listen: (cb) => ((onMessage = cb), () => {}) };
    const tabA = setup({ channel, online: false });
    tabA.client.start();
    await tabA.client.submitTap({ habitId: "h1" }, vi.fn());
    await tabA.storage.save([]); // another tab sent it
    onMessage();
    await vi.waitFor(() => expect(tabA.flushed).toEqual([{ counts: new Map(), changed: true, poisoned: 0 }]));
    tabA.setOnline(true);
    await tabA.client.submitTap({ habitId: "h2" }, async () => Promise.reject(new TypeError("x")));
    await tabA.client.flush();
    expect(post).toHaveBeenCalled();
  });
});

describe("Undo for a queued tap", () => {
  it("offline: the tap leaves the queue and nothing is sent when the phone is back online", async () => {
    const sent: string[] = [];
    const { client, storage, setOnline } = setup({ online: false, send: async (e) => (sent.push(`${e.kind}:${e.habitId}`), "synced") });
    await client.submitTap({ habitId: "h1" }, async () => ({ ok: true }));
    await client.submitTap({ habitId: "h2" }, async () => ({ ok: true }));
    expect(await client.undoQueued("h1")).toBe(true);
    expect((await storage.load()).map((e) => e.habitId)).toEqual(["h2"]);
    setOnline(true);
    await client.flush();
    expect(sent).toEqual(["check_in:h2"]);
  });

  it("takes back only the latest tap on that habit, and only mine (not a child's)", async () => {
    const { client, storage } = setup({ online: false });
    await client.submitTap({ habitId: "h1" }, async () => ({ ok: true }));
    await client.submitTap({ habitId: "h1", subjectId: "kid" }, async () => ({ ok: true }));
    await client.submitTap({ habitId: "h1" }, async () => ({ ok: true }));
    const [first] = await storage.load();
    await client.undoQueued("h1");
    expect((await storage.load()).map((e) => e.clientId)).toEqual([first.clientId, expect.any(String)]);
    expect((await storage.load()).map((e) => (e.kind === "check_in" ? e.subjectId : "undo"))).toEqual([null, "kid"]);
  });

  it("nothing waiting: false, nothing queued", async () => {
    const { client, storage } = setup({ online: false });
    expect(await client.undoQueued("h1")).toBe(false);
    expect(await storage.load()).toEqual([]);
  });
});
