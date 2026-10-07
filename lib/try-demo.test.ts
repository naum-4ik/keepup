import { describe, expect, it, vi } from "vitest";
import { runTryIt } from "./try-demo";

const REDIRECT = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;push;/today;307;" });

function deps(over: Partial<Parameters<typeof runTryIt>[0]> = {}) {
  return {
    hasSession: vi.fn(async () => false),
    signIn: vi.fn(async () => ({ error: null })),
    start: vi.fn(async () => { throw REDIRECT; }),
    signOut: vi.fn(async () => {}),
    rethrow: vi.fn((e: unknown) => { if (e === REDIRECT) throw e; }),
    ...over,
  };
}

describe("runTryIt", () => {
  it("signs in anonymously, then seeds; the action's redirect goes through", async () => {
    const d = deps();
    await expect(runTryIt(d)).rejects.toBe(REDIRECT);
    expect(d.signIn).toHaveBeenCalledOnce();
    expect(d.start).toHaveBeenCalledOnce();
    expect(d.signOut).not.toHaveBeenCalled();
  });

  it("already signed in (a stale landing tab): never signs in over that session", async () => {
    const d = deps({ hasSession: vi.fn(async () => true) });
    await expect(runTryIt(d)).rejects.toBe(REDIRECT);
    expect(d.signIn).not.toHaveBeenCalled();
    expect(d.start).toHaveBeenCalledOnce();
  });

  it("the sign-in fails: says so, nothing else runs", async () => {
    const d = deps({ signIn: vi.fn(async () => ({ error: new Error("rate limit") })) });
    expect(await runTryIt(d)).toBe("failed");
    expect(d.start).not.toHaveBeenCalled();
    expect(d.signOut).not.toHaveBeenCalled();
  });

  it("the seed call itself breaks (network, deploy skew): leaves the unseeded login, says so", async () => {
    const d = deps({ start: vi.fn(async () => { throw new TypeError("Failed to fetch"); }) });
    expect(await runTryIt(d)).toBe("failed");
    expect(d.signOut).toHaveBeenCalledOnce();
  });

  it("the seed call breaks for a session that was already there: never signs it out", async () => {
    const d = deps({ hasSession: vi.fn(async () => true), start: vi.fn(async () => { throw new TypeError("Failed to fetch"); }) });
    expect(await runTryIt(d)).toBe("failed");
    expect(d.signOut).not.toHaveBeenCalled();
  });
});
