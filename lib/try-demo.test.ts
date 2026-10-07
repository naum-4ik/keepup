import { describe, expect, it, vi } from "vitest";
import { runLeaveDemo, runTryIt } from "./try-demo";

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

describe("runLeaveDemo", () => {
  const TO_LOGIN = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;push;/login;307;" });
  function leaveDeps(over: Partial<Parameters<typeof runLeaveDemo>[0]> = {}) {
    const calls: string[] = [];
    return {
      calls,
      deps: {
        clearPhone: vi.fn(async () => void calls.push("clear")),
        leave: vi.fn(async () => {
          calls.push("leave");
          throw TO_LOGIN;
        }),
        rethrow: vi.fn((e: unknown) => { if (e === TO_LOGIN) throw e; }),
        ...over,
      },
    };
  }

  it("clears the phone first, then signs out; the redirect to /login goes through", async () => {
    const { calls, deps } = leaveDeps();
    await expect(runLeaveDemo(deps)).rejects.toBe(TO_LOGIN);
    expect(calls).toEqual(["clear", "leave"]);
  });

  it("still signs out when clearing the phone breaks", async () => {
    const { deps } = leaveDeps({ clearPhone: vi.fn(async () => { throw new Error("no storage"); }) });
    await expect(runLeaveDemo(deps)).rejects.toBe(TO_LOGIN);
    expect(deps.leave).toHaveBeenCalledOnce();
  });

  it("the sign-out call itself breaks: says so", async () => {
    const { deps } = leaveDeps({ leave: vi.fn(async () => { throw new TypeError("Failed to fetch"); }) });
    expect(await runLeaveDemo(deps)).toBe("failed");
  });
});
