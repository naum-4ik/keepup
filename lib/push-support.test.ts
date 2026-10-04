// lib/push-support.test.ts
import { describe, expect, it, vi } from "vitest";
import {
  deviceLabel, iosVersion, pushSupport, removeDevice, resaveOncePerLoad, signOutCleanup, signOutWithQueue, subscribeAndSave, urlBase64ToUint8Array, withTimeout,
  type PushEnv,
} from "./push-support";

const IPHONE_17 = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPHONE_16_3 = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1";
const IPHONE_16_10 = IPHONE_16_3.replace("16_3", "16_10");
const IPAD_DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";

const env = (o: Partial<PushEnv>): PushEnv => ({
  userAgent: ANDROID, maxTouchPoints: 5, standalone: false, hasServiceWorker: true, hasPushManager: true,
  permission: "default", vapidKey: "BKey", ...o,
});

describe("pushSupport", () => {
  it("an iPhone that hasn't installed Keepup needs the Home Screen first", () => {
    expect(pushSupport(env({ userAgent: IPHONE_17, hasPushManager: false, permission: "unsupported" }))).toBe("needs-install");
  });

  it("an installed iPhone on iOS 16.4+ is ready", () => {
    expect(pushSupport(env({ userAgent: IPHONE_17, standalone: true }))).toBe("ready");
  });

  it("iOS before 16.4 can't, and says so (16.10 is newer than 16.4)", () => {
    expect(pushSupport(env({ userAgent: IPHONE_16_3, standalone: true }))).toBe("ios-too-old");
    expect(pushSupport(env({ userAgent: IPHONE_16_10, standalone: true }))).toBe("ready");
  });

  it("an iPad that says it's a Mac still needs installing", () => {
    expect(pushSupport(env({ userAgent: IPAD_DESKTOP, maxTouchPoints: 5 }))).toBe("needs-install");
    expect(pushSupport(env({ userAgent: IPAD_DESKTOP, maxTouchPoints: 0 }))).toBe("ready");
  });

  it("Android Chrome works in the browser", () => {
    expect(pushSupport(env({}))).toBe("ready");
  });

  it("blocked, unsupported and not configured", () => {
    expect(pushSupport(env({ permission: "denied" }))).toBe("blocked");
    expect(pushSupport(env({ hasPushManager: false }))).toBe("unsupported");
    expect(pushSupport(env({ vapidKey: undefined }))).toBe("not-configured");
  });

  it("reads iOS versions", () => {
    expect(iosVersion(IPHONE_17, 5)).toEqual([17, 5]);
    expect(iosVersion(ANDROID, 5)).toBeNull();
  });
});

describe("deviceLabel", () => {
  it("names the phone and browser", () => {
    expect(deviceLabel(IPHONE_17)).toBe("iPhone · Safari");
    expect(deviceLabel(ANDROID)).toBe("Android · Chrome");
    expect(deviceLabel(null)).toBe("A device");
  });
});

describe("urlBase64ToUint8Array", () => {
  it("decodes the VAPID public key", () => {
    expect([...urlBase64ToUint8Array("AQID_-8")]).toEqual([1, 2, 3, 255, 239]);
  });
});

describe("signOutCleanup", () => {
  const quiet = { deleteQueue: async () => undefined };

  it("unsubscribes this device before signing out, so the next account's pushes don't reach the last one", async () => {
    const calls: string[] = [];
    await signOutCleanup({
      ...quiet,
      getSubscription: async () => ({ endpoint: "https://push.example/abc", unsubscribe: async () => (calls.push("unsubscribe"), true) }),
      forget: async (e) => void calls.push(`forget ${e}`),
      clearCaches: async () => void calls.push("caches"),
    });
    expect(calls).toEqual(["forget https://push.example/abc", "unsubscribe", "caches"]);
  });

  it("still clears caches when there is no worker or the server can't be reached", async () => {
    const clearCaches = vi.fn(async () => undefined);
    await signOutCleanup({ ...quiet, getSubscription: async () => { throw new Error("no worker"); }, forget: async () => undefined, clearCaches });
    await signOutCleanup({
      ...quiet,
      getSubscription: async () => ({ endpoint: "e", unsubscribe: async () => true }),
      forget: async () => { throw new TypeError("Failed to fetch"); },
      clearCaches,
    });
    expect(clearCaches).toHaveBeenCalledTimes(2);
  });

  it("deletes the queue last, and a blocked delete never stops the sign-out", async () => {
    const calls: string[] = [];
    await signOutCleanup({
      getSubscription: async () => ({ endpoint: "e", unsubscribe: async () => (calls.push("unsubscribe"), true) }),
      forget: async () => void calls.push("forget"),
      clearCaches: async () => void calls.push("caches"),
      deleteQueue: async () => void calls.push("delete queue"),
    });
    expect(calls).toEqual(["forget", "unsubscribe", "caches", "delete queue"]);

    vi.useFakeTimers();
    try {
      const done = signOutCleanup({
        getSubscription: async () => null, forget: async () => undefined, clearCaches: async () => undefined,
        deleteQueue: () => new Promise<void>(() => {}), // another tab holds the database
      });
      await vi.advanceTimersByTimeAsync(2_000);
      await expect(done).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("signOutWithQueue", () => {
  // A queue with `left` check-ins after the send, and a person who answers the confirm with `answer`.
  function flow(o: { left: number; answer?: boolean; flushQueue?: () => Promise<void> }) {
    const calls: string[] = [];
    const deps = {
      flushQueue: o.flushQueue ?? (async () => void calls.push("flush")),
      pendingCount: async () => (calls.push("count"), o.left),
      confirmDrop: vi.fn(async (n: number) => (calls.push(`confirm ${n}`), o.answer ?? false)),
      cleanup: async () => void calls.push("cleanup"),
      signOut: async () => void calls.push("sign out"),
    };
    return { calls, deps };
  }

  it("an empty queue after the send: signs out without asking", async () => {
    const { calls, deps } = flow({ left: 0 });
    expect(await signOutWithQueue(deps)).toBe("signed_out");
    expect(calls).toEqual(["flush", "count", "cleanup", "sign out"]);
    expect(deps.confirmDrop).not.toHaveBeenCalled();
  });

  it("check-ins left: asks first; Stay signed in touches nothing", async () => {
    const { calls, deps } = flow({ left: 2, answer: false });
    expect(await signOutWithQueue(deps)).toBe("stayed");
    expect(calls).toEqual(["flush", "count", "confirm 2"]);
  });

  it("check-ins left: Sign out anyway removes them and signs out", async () => {
    const { calls, deps } = flow({ left: 1, answer: true });
    expect(await signOutWithQueue(deps)).toBe("signed_out");
    expect(calls).toEqual(["flush", "count", "confirm 1", "cleanup", "sign out"]);
  });

  it("waits at most 5 seconds for the send, then asks", async () => {
    vi.useFakeTimers();
    try {
      const { deps } = flow({ left: 1, answer: false, flushQueue: () => new Promise<void>(() => {}) });
      const done = signOutWithQueue(deps);
      await vi.advanceTimersByTimeAsync(4_999);
      expect(deps.confirmDrop).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(await done).toBe("stayed");
      expect(deps.confirmDrop).toHaveBeenCalledWith(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a send that fails (offline) still asks about what's left", async () => {
    const { deps } = flow({ left: 3, answer: false, flushQueue: async () => { throw new TypeError("Failed to fetch"); } });
    expect(await signOutWithQueue(deps)).toBe("stayed");
    expect(deps.confirmDrop).toHaveBeenCalledWith(3);
  });
});

const fakeSub = (endpoint: string, p256dh = "p", auth = "a") => ({
  endpoint,
  toJSON: () => ({ endpoint, keys: { p256dh, auth } }),
  unsubscribe: vi.fn(async () => true),
});
const FCM = "https://fcm.googleapis.com/fcm/send/";

describe("subscribeAndSave", () => {
  it("saves the subscription this browser already has, or a new one", async () => {
    const save = vi.fn(async () => ({ ok: true as const }));
    const subscribe = vi.fn(async () => fakeSub(`${FCM}new`));
    expect(await subscribeAndSave({ current: async () => fakeSub(`${FCM}old`), subscribe, save })).toEqual({ ok: true });
    expect(subscribe).not.toHaveBeenCalled();
    expect(save).toHaveBeenLastCalledWith({ endpoint: `${FCM}old`, p256dh: "p", auth: "a" });

    await subscribeAndSave({ current: async () => null, subscribe, save });
    expect(save).toHaveBeenLastCalledWith({ endpoint: `${FCM}new`, p256dh: "p", auth: "a" });
  });

  it("when another account holds the endpoint, subscribes afresh and tries once more", async () => {
    const taken = fakeSub(`${FCM}taken`);
    const refused = { ok: false as const, message: "This device couldn't be set up for notifications.", code: "invalid_subscription" };
    const save = vi.fn().mockResolvedValueOnce(refused).mockResolvedValueOnce({ ok: true });
    const r = await subscribeAndSave({ current: async () => taken, subscribe: async () => fakeSub(`${FCM}fresh`, "p2", "a2"), save });
    expect(r).toEqual({ ok: true });
    expect(taken.unsubscribe).toHaveBeenCalled();
    expect(save).toHaveBeenLastCalledWith({ endpoint: `${FCM}fresh`, p256dh: "p2", auth: "a2" });

    const always = vi.fn(async () => refused);
    expect(await subscribeAndSave({ current: async () => taken, subscribe: async () => fakeSub(`${FCM}fresh`), save: always })).toEqual(refused);
    expect(always).toHaveBeenCalledTimes(2);
  });

  it("other refusals are not retried", async () => {
    const save = vi.fn(async () => ({ ok: false as const, message: "Something went wrong." }));
    const subscribe = vi.fn(async () => fakeSub(`${FCM}x`));
    await subscribeAndSave({ current: async () => fakeSub(`${FCM}y`), subscribe, save });
    expect(save).toHaveBeenCalledTimes(1);
    expect(subscribe).not.toHaveBeenCalled();
  });
});

describe("resaveOncePerLoad", () => {
  it("re-saves this device's subscription once per page load, however often it's called", async () => {
    const save = vi.fn(async () => undefined);
    const resave = resaveOncePerLoad({ permission: () => "granted", getSubscription: async () => fakeSub(`${FCM}me`), save });
    await Promise.all([resave(), resave()]);
    await resave();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ endpoint: `${FCM}me`, p256dh: "p", auth: "a" });
  });

  it("does nothing without a subscription or permission, and never throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const save = vi.fn(async () => undefined);
    await resaveOncePerLoad({ permission: () => "granted", getSubscription: async () => null, save })();
    await resaveOncePerLoad({ permission: () => "default", getSubscription: async () => fakeSub(`${FCM}me`), save })();
    await expect(resaveOncePerLoad({ permission: () => "granted", getSubscription: async () => { throw new Error("no worker"); }, save })()).resolves.toBeUndefined();
    expect(save).not.toHaveBeenCalled();
  });
});

describe("removeDevice", () => {
  const ok = async () => ({ ok: true as const });

  it("removing this device also ends its browser subscription", async () => {
    const here = fakeSub(`${FCM}me`);
    expect(await removeDevice({ endpoint: `${FCM}me`, here: `${FCM}me`, forget: ok, getSubscription: async () => here })).toEqual({ ok: true });
    expect(here.unsubscribe).toHaveBeenCalled();
  });

  it("another device, or a refused remove, leaves this browser's subscription alone", async () => {
    const here = fakeSub(`${FCM}me`);
    await removeDevice({ endpoint: `${FCM}phone`, here: `${FCM}me`, forget: ok, getSubscription: async () => here });
    const refused = { ok: false as const, message: "Something went wrong." };
    expect(await removeDevice({ endpoint: `${FCM}me`, here: `${FCM}me`, forget: async () => refused, getSubscription: async () => here })).toEqual(refused);
    expect(here.unsubscribe).not.toHaveBeenCalled();
  });

  it("a failing unsubscribe doesn't undo the remove", async () => {
    const here = { ...fakeSub(`${FCM}me`), unsubscribe: vi.fn(async () => Promise.reject(new Error("no"))) };
    expect(await removeDevice({ endpoint: `${FCM}me`, here: `${FCM}me`, forget: ok, getSubscription: async () => here })).toEqual({ ok: true });
  });
});

describe("withTimeout", () => {
  it("gives up on a service worker that never becomes ready", async () => {
    vi.useFakeTimers();
    try {
      const never = withTimeout(new Promise(() => undefined), 10_000);
      const check = expect(never).rejects.toThrow("timed out");
      await vi.advanceTimersByTimeAsync(10_000);
      await check;
      await expect(withTimeout(Promise.resolve(1), 10_000)).resolves.toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
