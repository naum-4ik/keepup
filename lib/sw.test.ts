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

function worker(windows: Win[], openWindow = vi.fn(async () => null), fetchImpl = vi.fn()) {
  const handlers: Record<string, (e: unknown) => void> = {};
  const self = {
    location: { href: `${ORIGIN}/sw.js?v=test`, origin: ORIGIN },
    addEventListener: (type: string, fn: (e: unknown) => void) => void (handlers[type] = fn),
    clients: { matchAll: async () => windows, openWindow, claim: async () => {} },
    skipWaiting: () => {},
  };
  runInNewContext(SOURCE, { self, URL, fetch: fetchImpl, console: { error: () => {} } });
  async function click(data: Record<string, unknown>, action = "") {
    let pending: Promise<unknown> = Promise.resolve();
    handlers.notificationclick({ action, notification: { data, close: () => {} }, waitUntil: (p: Promise<unknown>) => (pending = p) });
    await pending;
  }
  return { click, openWindow };
}

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
