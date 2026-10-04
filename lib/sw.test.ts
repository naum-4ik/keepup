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

// A stand-in CacheStorage: caches by name, entries by absolute URL (a path is read against ORIGIN).
type Res = { ok: boolean; redirected?: boolean; body: string; clone(): Res; text(): Promise<string> };
const res = (body: string, o: { ok?: boolean; redirected?: boolean } = {}): Res => ({
  ok: o.ok ?? true, redirected: o.redirected ?? false, body, clone: () => res(body, o), text: async () => body,
});
function fakeCaches() {
  const store = new Map<string, Map<string, Res>>();
  const keyOf = (r: string | { url: string }) => new URL(typeof r === "string" ? r : r.url, ORIGIN).href;
  const open = async (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    const c = store.get(name)!;
    return {
      keys: async () => [...c.keys()],
      delete: async (r: string | { url: string }) => c.delete(keyOf(r)),
      match: async (r: string | { url: string }) => c.get(keyOf(r)),
      put: async (r: string | { url: string }, v: Res) => {
        c.delete(keyOf(r)); // the Cache API keeps insertion order; a replaced entry goes last
        c.set(keyOf(r), v);
      },
      add: async (r: string) => {
        const v = await fetchForAdd(r);
        if (!v.ok) throw new TypeError("bad response");
        c.set(keyOf(r), v);
      },
      addAll: async (rs: string[]) => {
        const vs = await Promise.all(rs.map(fetchForAdd));
        if (vs.some((v) => !v.ok)) throw new TypeError("bad response");
        rs.forEach((r, i) => c.set(keyOf(r), vs[i]));
      },
    };
  };
  let fetchForAdd: (url: string) => Promise<Res> = async () => res("");
  return {
    api: {
      open,
      keys: async () => [...store.keys()],
      delete: async (name: string) => store.delete(name),
      match: async (r: string) => {
        for (const c of store.values()) if (c.has(keyOf(r))) return c.get(keyOf(r));
        return undefined;
      },
    },
    store,
    useFetch: (f: (url: string) => Promise<Res>) => void (fetchForAdd = f),
    clear: () => store.clear(),
  };
}

function worker(windows: Win[], openWindow = vi.fn(async () => null), fetchImpl = vi.fn(), subscribe = vi.fn(), cacheStore = fakeCaches(), version = "test") {
  const handlers: Record<string, (e: unknown) => void> = {};
  const showNotification = vi.fn(async () => undefined);
  const self = {
    location: { href: `${ORIGIN}/sw.js?v=${version}`, origin: ORIGIN },
    addEventListener: (type: string, fn: (e: unknown) => void) => void (handlers[type] = fn),
    clients: { matchAll: async () => windows, openWindow, claim: async () => {} },
    skipWaiting: () => {},
    registration: { pushManager: { subscribe }, showNotification },
  };
  cacheStore.useFetch((url) => fetchImpl(url));
  // new Response(body) in the worker: a constructor that returns a stand-in response.
  const ResponseStub = Object.assign(function (body: string) { return res(String(body)); }, { error: () => ({ ok: false, error: true }) });
  runInNewContext(SOURCE, { self, URL, fetch: fetchImpl, caches: cacheStore.api, Response: ResponseStub, console: { error: () => {} } });
  // A fetch event: undefined when the worker leaves it to the network, else what it answered.
  async function request(path: string, init: { method?: string; mode?: string } = {}) {
    let answer: Promise<unknown> | undefined;
    const waits: Promise<unknown>[] = [];
    handlers.fetch({
      request: { url: new URL(path, ORIGIN).href, method: init.method ?? "GET", mode: init.mode ?? "navigate" },
      respondWith: (p: Promise<unknown>) => (answer = p),
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    });
    const out = answer ? await answer : undefined;
    await Promise.all(waits);
    return out as Res | { ok: false; error: true } | undefined;
  }
  async function message(data: unknown, ports: { postMessage: (m: unknown) => void }[] = []) {
    let pending: Promise<unknown> = Promise.resolve();
    handlers.message({ data, ports, waitUntil: (p: Promise<unknown>) => (pending = p) });
    await pending;
  }
  async function lifecycle(type: "install" | "activate") {
    let pending: Promise<unknown> = Promise.resolve();
    handlers[type]({ waitUntil: (p: Promise<unknown>) => (pending = p) });
    await pending;
  }
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
  return { click, openWindow, subscriptionChange, push, request, lifecycle, message, caches: cacheStore };
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

// The saved pages, without each one's list of scripts (stored next to it).
const savedPages = (sw: { caches: ReturnType<typeof fakeCaches> }) =>
  [...(sw.caches.store.get("keepup-pages")?.keys() ?? [])].filter((k) => !k.includes("/__keepup-assets__/"));

describe("sw.js offline shell", () => {
  // The network: each path's page, or a thrown TypeError when offline.
  function network() {
    let online = true;
    const pages: Record<string, Res> = { "/offline": res("offline page") };
    const fetchImpl = vi.fn(async (r: string | { url: string }) => {
      if (!online) throw new TypeError("Failed to fetch");
      const path = new URL(typeof r === "string" ? r : r.url, ORIGIN).pathname;
      return pages[path] ?? res(`page ${path}`);
    });
    return { fetchImpl, pages, setOnline: (v: boolean) => void (online = v) };
  }

  it("install saves the offline page; activate drops older versions and keeps the saved pages", async () => {
    const net = network();
    const sw = worker([], undefined, net.fetchImpl);
    await (await sw.caches.api.open("keepup-shell-old")).put("/offline", res("old"));
    await (await sw.caches.api.open("keepup-pages")).put("/today", res("today"));
    await sw.lifecycle("install");
    await sw.lifecycle("activate");
    expect([...sw.caches.store.keys()].sort()).toEqual(["keepup-assets", "keepup-pages", "keepup-shell-test"]);
    expect((await sw.caches.api.match("/offline"))?.body).toBe("offline page");
  });

  it("the offline page's own scripts are saved with it, at install and when it is saved again", async () => {
    const net = network();
    net.pages["/offline"] = res('offline page "static/chunks/offline-icon.js"');
    const sw = worker([], undefined, net.fetchImpl);
    await sw.lifecycle("install");
    expect(await sw.caches.api.match("/_next/static/chunks/offline-icon.js")).toBeDefined();
    sw.caches.clear(); // sign-out
    await sw.request("/progress");
    expect(await sw.caches.api.match("/offline")).toBeDefined();
    expect(await sw.caches.api.match("/_next/static/chunks/offline-icon.js")).toBeDefined();
  });

  it("installs (and takes over) even when the offline page can't be saved", async () => {
    const net = network();
    net.setOnline(false);
    const sw = worker([], undefined, net.fetchImpl);
    await expect(sw.lifecycle("install")).resolves.toBeUndefined();
  });

  it("online, Today is fresh from the network and saved; offline, the saved copy shows", async () => {
    const net = network();
    const sw = worker([], undefined, net.fetchImpl);
    net.pages["/today"] = res("today v1");
    expect((await sw.request("/today"))?.ok).toBe(true);
    net.pages["/today"] = res("today v2");
    expect((await sw.request("/today")) as Res).toMatchObject({ body: "today v2" });
    net.setOnline(false);
    expect((await sw.request("/today")) as Res).toMatchObject({ body: "today v2" });
  });

  it("offline, a page that isn't saved gets the offline page", async () => {
    const net = network();
    const sw = worker([], undefined, net.fetchImpl);
    await sw.lifecycle("install");
    net.setOnline(false);
    expect((await sw.request("/progress")) as Res).toMatchObject({ body: "offline page" });
  });

  it("saves the kid view, but no other page", async () => {
    const net = network();
    const sw = worker([], undefined, net.fetchImpl);
    await sw.request("/kids/00000000-0000-0000-0000-0000000000f1/play");
    await sw.request("/kids/00000000-0000-0000-0000-0000000000f1");
    await sw.request("/progress");
    expect(savedPages(sw)).toEqual([`${ORIGIN}/kids/00000000-0000-0000-0000-0000000000f1/play`]);
  });

  it("never touches the API, POSTs (server actions), other sites or Next's data requests", async () => {
    const net = network();
    const sw = worker([], undefined, net.fetchImpl);
    expect(await sw.request("/api/check-ins/sync", { method: "POST", mode: "cors" })).toBeUndefined();
    expect(await sw.request("/api/push-subscription", { mode: "cors" })).toBeUndefined();
    expect(await sw.request("/today", { method: "POST", mode: "navigate" })).toBeUndefined();
    expect(await sw.request("https://evil.example/today")).toBeUndefined();
    expect(await sw.request("/today?_rsc=abc", { mode: "cors" })).toBeUndefined();
    expect(net.fetchImpl).not.toHaveBeenCalled();
    expect(sw.caches.store.get("keepup-pages")).toBeUndefined();
  });

  it("built assets come from the cache once saved", async () => {
    const net = network();
    const sw = worker([], undefined, net.fetchImpl);
    await sw.request("/_next/static/chunks/app.js", { mode: "no-cors" });
    net.setOnline(false);
    expect((await sw.request("/_next/static/chunks/app.js", { mode: "no-cors" })) as Res).toMatchObject({ body: "page /_next/static/chunks/app.js" });
    expect(net.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("after sign-out: a redirect to the login page is never saved as Today, and the offline page comes back", async () => {
    const net = network();
    const sw = worker([], undefined, net.fetchImpl);
    await sw.lifecycle("install");
    net.pages["/today"] = res("Anna's today");
    await sw.request("/today");
    sw.caches.clear(); // signOutCleanup deletes every cache
    net.pages["/today"] = res("login page", { redirected: true });
    await sw.request("/today");
    net.setOnline(false);
    expect((await sw.request("/today")) as Res).toMatchObject({ body: "offline page" });
  });

  it("offline with nothing saved at all: a network error, not a hang", async () => {
    const net = network();
    const sw = worker([], undefined, net.fetchImpl);
    net.setOnline(false);
    expect(await sw.request("/progress")).toEqual({ ok: false, error: true });
  });

  it("a page saved before a deploy still finds its scripts after the new worker takes over", async () => {
    const net = network();
    const store = fakeCaches();
    const before = worker([], undefined, net.fetchImpl, undefined, store, "v1");
    await before.lifecycle("install");
    await before.lifecycle("activate");
    await before.request("/today");
    await before.request("/_next/static/chunks/v1-app.js", { mode: "no-cors" });
    const after = worker([], undefined, net.fetchImpl, undefined, store, "v2");
    await after.lifecycle("install");
    await after.lifecycle("activate");
    expect([...store.store.keys()].sort()).toEqual(["keepup-assets", "keepup-pages", "keepup-shell-v2"]);
    net.setOnline(false);
    expect((await after.request("/today")) as Res).toMatchObject({ body: "page /today" });
    expect((await after.request("/_next/static/chunks/v1-app.js", { mode: "no-cors" })) as Res).toMatchObject({ body: "page /_next/static/chunks/v1-app.js" });
  });

  it("keeps the assets cache bounded, dropping the oldest", async () => {
    const net = network();
    const sw = worker([], undefined, net.fetchImpl);
    // Pruned every 25th save: after 325, the 300 newest are left.
    for (let i = 0; i < 325; i++) await sw.request(`/_next/static/chunks/${i}.js`, { mode: "no-cors" });
    const keys = [...sw.caches.store.get("keepup-assets")!.keys()];
    expect(keys).toHaveLength(300);
    expect(keys[0]).toBe(`${ORIGIN}/_next/static/chunks/25.js`);
  });

  it("a page reached by client-side navigation asks to be saved: Today and kid views only, same site, not a redirect", async () => {
    const net = network();
    const sw = worker([], undefined, net.fetchImpl);
    net.pages["/today"] = res("today now");
    await sw.message({ type: "keepup:save-page", path: "/today" });
    await sw.message({ type: "keepup:save-page", path: "/progress" });
    await sw.message({ type: "keepup:save-page", path: "https://evil.example/kids/00000000-0000-0000-0000-0000000000f1/play" });
    await sw.message({ type: "keepup:save-page", path: 42 });
    expect(savedPages(sw)).toEqual([`${ORIGIN}/today`]);
    net.pages["/today"] = res("login page", { redirected: true });
    await sw.message({ type: "keepup:save-page", path: "/today" });
    expect((await sw.caches.api.match("/today"))?.body).toBe("today now");
    net.setOnline(false);
    await expect(sw.message({ type: "keepup:save-page", path: "/today" })).resolves.toBeUndefined();
  });

  it("Today with a one-time query (?joined=…) is saved as the plain page", async () => {
    const net = network();
    const sw = worker([], undefined, net.fetchImpl);
    net.pages["/today"] = res("plain today");
    await sw.request("/today?joined=abc");
    expect((await sw.caches.api.match("/today"))?.body).toBe("plain today");
  });

  it("sign-out: waits for a save in flight, then clears every cache and says so", async () => {
    const net = network();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const slow = vi.fn(async (r: string | { url: string }) => {
      await gate;
      return net.fetchImpl(r);
    });
    const sw = worker([], undefined, slow);
    const saving = sw.message({ type: "keepup:save-page", path: "/today" });
    const port = { postMessage: vi.fn() };
    const clearing = sw.message({ type: "keepup:clear" }, [port]);
    release();
    await Promise.all([saving, clearing]);
    expect(sw.caches.store.size).toBe(0);
    expect(port.postMessage).toHaveBeenCalledWith("cleared");
  });

  it("overlapping saves of one page: a slow older answer never replaces the newer copy", async () => {
    const net = network();
    let releaseOld!: () => void;
    const oldGate = new Promise<void>((r) => (releaseOld = r));
    let calls = 0;
    const fetchImpl = vi.fn(async (r: string | { url: string }) => {
      calls++;
      if (calls === 1) {
        await oldGate;
        return res("today before the check-in");
      }
      return net.fetchImpl(r);
    });
    const sw = worker([], undefined, fetchImpl);
    net.pages["/today"] = res("today after the check-in");
    const older = sw.message({ type: "keepup:save-page", path: "/today" });
    await sw.message({ type: "keepup:save-page", path: "/today" });
    releaseOld();
    await older;
    expect((await sw.caches.api.match("/today"))?.body).toBe("today after the check-in");
  });

  it("saving a page also saves the scripts it lists, even ones it loads only on demand", async () => {
    const net = network();
    const sw = worker([], undefined, net.fetchImpl);
    net.pages["/today"] = res('<script src="/_next/static/chunks/main.js"></script><script>self.__next_f.push([1,"static/chunks/late-card.js"])</script>');
    await sw.message({ type: "keepup:save-page", path: "/today" });
    expect([...sw.caches.store.get("keepup-assets")!.keys()].sort()).toEqual([
      `${ORIGIN}/_next/static/chunks/late-card.js`,
      `${ORIGIN}/_next/static/chunks/main.js`,
    ]);
  });

  it("the prune never drops a script a saved page needs, and drops the least recently used first", async () => {
    const net = network();
    const sw = worker([], undefined, net.fetchImpl);
    net.pages["/today"] = res('"static/chunks/today-a.js" "static/chunks/today-b.js"');
    await sw.message({ type: "keepup:save-page", path: "/today" });
    await sw.request("/_next/static/chunks/old-but-used.js", { mode: "no-cors" });
    for (let i = 0; i < 330; i++) {
      await sw.request(`/_next/static/chunks/other-${i}.js`, { mode: "no-cors" });
      if (i % 50 === 0) await sw.request("/_next/static/chunks/old-but-used.js", { mode: "no-cors" }); // a hit keeps it recent
    }
    const keys = [...sw.caches.store.get("keepup-assets")!.keys()];
    expect(keys).toContain(`${ORIGIN}/_next/static/chunks/today-a.js`);
    expect(keys).toContain(`${ORIGIN}/_next/static/chunks/today-b.js`);
    expect(keys).toContain(`${ORIGIN}/_next/static/chunks/old-but-used.js`);
    expect(keys).not.toContain(`${ORIGIN}/_next/static/chunks/other-0.js`);
    expect(keys.length).toBeLessThanOrEqual(300 + 24);
    // The list lives in the cache, so a restarted worker still knows it.
    const restarted = worker([], undefined, net.fetchImpl, undefined, sw.caches);
    for (let i = 0; i < 50; i++) await restarted.request(`/_next/static/chunks/more-${i}.js`, { mode: "no-cors" });
    expect([...sw.caches.store.get("keepup-assets")!.keys()]).toContain(`${ORIGIN}/_next/static/chunks/today-a.js`);
  });
});
