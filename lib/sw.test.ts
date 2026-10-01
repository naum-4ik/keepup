// public/sw.js is plain JS served as is; this runs it in a stand-in worker scope.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const SOURCE = readFileSync(join(__dirname, "../public/sw.js"), "utf8");
const ORIGIN = "https://keepup.test";

type Win = { url: string; focus: ReturnType<typeof vi.fn>; navigate: ReturnType<typeof vi.fn> };

function win(path: string, navigate?: (url: string) => Promise<unknown>): Win {
  const w: Win = { url: `${ORIGIN}${path}`, focus: vi.fn(async () => w), navigate: vi.fn() };
  w.navigate.mockImplementation(navigate ?? (async (url: string) => ({ ...w, url, focus: w.focus })));
  return w;
}

function worker(windows: Win[], openWindow = vi.fn(async () => null), fetchImpl = vi.fn(), subscribe = vi.fn()) {
  const handlers: Record<string, (e: unknown) => void> = {};
  const showNotification = vi.fn(async () => undefined);
  const self = {
    location: { href: `${ORIGIN}/sw.js?v=test`, origin: ORIGIN },
    addEventListener: (type: string, fn: (e: unknown) => void) => void (handlers[type] = fn),
    clients: { matchAll: async () => windows, openWindow, claim: async () => {} },
    skipWaiting: () => {},
    registration: { pushManager: { subscribe }, showNotification },
  };
  runInNewContext(SOURCE, { self, URL, fetch: fetchImpl, console: { error: () => {} } });
  async function click(data: Record<string, unknown>, action = "") {
    let pending: Promise<unknown> = Promise.resolve();
    handlers.notificationclick({ action, notification: { data, close: () => {} }, waitUntil: (p: Promise<unknown>) => (pending = p) });
    await pending;
  }
  async function subscriptionChange(event: Record<string, unknown>) {
    let pending: Promise<unknown> = Promise.resolve();
    handlers.pushsubscriptionchange({ ...event, waitUntil: (p: Promise<unknown>) => (pending = p) });
    await pending;
  }
  async function push(data: Record<string, unknown>) {
    let pending: Promise<unknown> = Promise.resolve();
    handlers.push({ data: { json: () => data }, waitUntil: (p: Promise<unknown>) => (pending = p) });
    await pending;
    return showNotification.mock.calls.at(-1) as unknown as [string, Record<string, unknown>];
  }
  return { click, openWindow, subscriptionChange, push };
}

describe("sw.js push", () => {
  it("is silent by default, and doesn't buzz again for a replaced notification", async () => {
    const [title, options] = await worker([]).push({ title: "Family", body: "Hi", tag: "habit:h1" });
    expect(title).toBe("Family");
    expect(options).toMatchObject({ silent: true, renotify: false, tag: "habit:h1" });
  });

  it("Sound: not silent, and a replaced notification rings again", async () => {
    const [, options] = await worker([]).push({ title: "Family", body: "Hi", tag: "habit:h1", silent: false });
    expect(options).toMatchObject({ silent: false, renotify: true });
  });

  it("never asks to renotify without a tag", async () => {
    const [, options] = await worker([]).push({ title: "Family", body: "Hi", silent: false });
    expect(options).toMatchObject({ silent: false, renotify: false });
  });
});

describe("sw.js notification taps", () => {
  it("focuses a window already at the url, without navigating", async () => {
    const other = win("/today");
    const inbox = win("/inbox");
    const { click, openWindow } = worker([other, inbox]);
    await click({ url: "/inbox" });
    expect(inbox.focus).toHaveBeenCalled();
    expect(other.navigate).not.toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it("otherwise moves an open window there and focuses it", async () => {
    const today = win("/today");
    const { click, openWindow } = worker([today]);
    await click({ url: "/habits/h1" });
    expect(today.navigate).toHaveBeenCalledWith(`${ORIGIN}/habits/h1`);
    expect(today.focus).toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it("opens a new window when navigate fails", async () => {
    const today = win("/today", async () => Promise.reject(new TypeError("not controlled")));
    const { click, openWindow } = worker([today]);
    await click({ url: "/inbox" });
    expect(openWindow).toHaveBeenCalledWith(`${ORIGIN}/inbox`);
  });

  it("never rejects, even when opening a window fails", async () => {
    const { click } = worker([], vi.fn(async () => Promise.reject(new Error("no"))));
    await expect(click({ url: "/inbox" })).resolves.toBeUndefined();
  });

  it("a failed Approve opens the Inbox", async () => {
    const { click, openWindow } = worker([], undefined, vi.fn(async () => ({ ok: false })));
    await click({ url: "/inbox", checkInId: "c1" }, "approve");
    expect(openWindow).toHaveBeenCalledWith(`${ORIGIN}/inbox`);
  });
});

describe("sw.js pushsubscriptionchange", () => {
  const key = new Uint8Array([1, 2, 3]).buffer;
  const OLD = "https://fcm.googleapis.com/fcm/send/old";
  const fresh = {
    endpoint: "https://fcm.googleapis.com/fcm/send/fresh",
    toJSON: () => ({ endpoint: "https://fcm.googleapis.com/fcm/send/fresh", keys: { p256dh: "p", auth: "a" } }),
  };

  it("subscribes again with the old options and saves the new subscription", async () => {
    const subscribe = vi.fn(async () => fresh);
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    const { subscriptionChange } = worker([], undefined, fetchImpl, subscribe);
    await subscriptionChange({ oldSubscription: { endpoint: OLD, options: { applicationServerKey: key, userVisibleOnly: true } } });
    expect(subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: key });
    expect(fetchImpl).toHaveBeenCalledWith("/api/push-subscription", expect.objectContaining({ method: "POST", credentials: "same-origin" }));
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, { body: string }];
    expect(JSON.parse(init.body)).toEqual({ endpoint: fresh.endpoint, p256dh: "p", auth: "a", oldEndpoint: OLD });
  });

  it("uses the new subscription when the browser already made one", async () => {
    const subscribe = vi.fn();
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    const { subscriptionChange } = worker([], undefined, fetchImpl, subscribe);
    await subscriptionChange({ oldSubscription: { endpoint: OLD, options: {} }, newSubscription: fresh });
    expect(subscribe).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does nothing without the old subscription, and never rejects when subscribe or the save fails", async () => {
    const fetchImpl = vi.fn(async () => Promise.reject(new TypeError("offline")));
    const quiet = worker([], undefined, fetchImpl, vi.fn());
    await expect(quiet.subscriptionChange({ oldSubscription: null })).resolves.toBeUndefined();
    await expect(quiet.subscriptionChange({ oldSubscription: null, newSubscription: fresh })).resolves.toBeUndefined();
    await expect(quiet.subscriptionChange({ oldSubscription: { endpoint: OLD, options: {} } })).resolves.toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();

    const failing = worker([], undefined, fetchImpl, vi.fn(async () => Promise.reject(new Error("denied"))));
    await expect(failing.subscriptionChange({ oldSubscription: { endpoint: OLD, options: { applicationServerKey: key } } })).resolves.toBeUndefined();
    const offline = worker([], undefined, fetchImpl, vi.fn(async () => fresh));
    await expect(offline.subscriptionChange({ oldSubscription: { endpoint: OLD, options: { applicationServerKey: key } } })).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
