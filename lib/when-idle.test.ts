import { describe, expect, it, vi } from "vitest";
import { IDLE_TIMEOUT_MS, whenIdle } from "./when-idle";

// A fake window: `load` and idle callbacks fire when the test says so.
function fakeWindow({ readyState = "loading", idle = true }: { readyState?: DocumentReadyState; idle?: boolean } = {}) {
  const listeners = new Map<string, () => void>();
  const idles = new Map<number, () => void>();
  const timers = new Map<number, () => void>();
  let next = 1;
  const win = {
    document: { readyState },
    addEventListener: vi.fn((type: string, cb: () => void) => listeners.set(type, cb)),
    removeEventListener: vi.fn((type: string) => listeners.delete(type)),
    setTimeout: vi.fn((cb: () => void) => (timers.set(next, cb), next++)),
    clearTimeout: vi.fn((h: number) => timers.delete(h)),
    requestIdleCallback: idle ? vi.fn((cb: () => void) => (idles.set(next, cb), next++)) : undefined,
    cancelIdleCallback: idle ? vi.fn((h: number) => idles.delete(h)) : undefined,
  };
  return {
    win: win as unknown as Parameters<typeof whenIdle>[1],
    raw: win,
    load: () => listeners.get("load")?.(),
    goIdle: () => [...idles.values()].forEach((cb) => cb()),
    tick: () => [...timers.values()].forEach((cb) => cb()),
  };
}

describe("whenIdle", () => {
  it("waits for load, then for an idle moment", () => {
    const run = vi.fn();
    const w = fakeWindow();
    whenIdle(run, w.win);
    w.goIdle();
    expect(run).not.toHaveBeenCalled();
    w.load();
    expect(run).not.toHaveBeenCalled();
    w.goIdle();
    expect(run).toHaveBeenCalledOnce();
    expect(w.raw.requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: IDLE_TIMEOUT_MS });
  });

  it("on a page that has already loaded, waits only for idle", () => {
    const run = vi.fn();
    const w = fakeWindow({ readyState: "complete" });
    whenIdle(run, w.win);
    expect(w.raw.addEventListener).not.toHaveBeenCalled();
    w.goIdle();
    expect(run).toHaveBeenCalledOnce();
  });

  it("without requestIdleCallback, a short timeout after load", () => {
    const run = vi.fn();
    const w = fakeWindow({ idle: false });
    whenIdle(run, w.win);
    w.load();
    w.tick();
    expect(run).toHaveBeenCalledOnce();
  });

  it("cancelled before load: never runs and stops listening", () => {
    const run = vi.fn();
    const w = fakeWindow();
    const cancel = whenIdle(run, w.win);
    cancel();
    expect(w.raw.removeEventListener).toHaveBeenCalledWith("load", expect.any(Function));
    w.load();
    w.goIdle();
    expect(run).not.toHaveBeenCalled();
  });

  it("cancelled while waiting for idle: never runs", () => {
    const run = vi.fn();
    const w = fakeWindow({ readyState: "complete" });
    const cancel = whenIdle(run, w.win);
    cancel();
    expect(w.raw.cancelIdleCallback).toHaveBeenCalled();
    w.goIdle();
    expect(run).not.toHaveBeenCalled();
  });
});
