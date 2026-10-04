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

  it("a rule refusal says why and leaves nothing queued", async () => {
    const { client, storage } = setup();
    expect(await client.submitTap({ habitId: "h1" }, async () => ({ ok: false, message: "This habit is paused." }))).toEqual({
      ok: false, message: "This habit is paused.",
    });
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

  it("a server that keeps failing: backs off, then gives the entry up and says so", async () => {
    const send = vi.fn<Sender>(async () => "retry");
    const { client, flushed, setOnline } = setup({ send });
    setOnline(false);
    await client.submitTap({ habitId: "h1" }, vi.fn());
    setOnline(true);
    await client.flush(); // 1
    await vi.advanceTimersByTimeAsync(3_000 + 6_000 + 12_000 + 24_000); // 2..5
    expect(send).toHaveBeenCalledTimes(5);
    expect(flushed.at(-1)).toEqual({ counts: new Map(), changed: true, poisoned: 1 });
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
