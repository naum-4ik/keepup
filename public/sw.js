// public/sw.js
// Keepup's one service worker (ideas/installable-app.md, ideas/offline.md): push, notification taps,
// and the offline app shell. Plain JS, not bundled; keep it small. Queued check-ins live in the
// page's IndexedDB and are sent by the page (no Background Sync, owner decision).
// The version comes from the registration URL (/sw.js?v=<commit>), so every deploy installs anew.
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const SHELL = `keepup-shell-${VERSION}`; // the offline page and icons of this version
// Built assets (/_next/static, content-hashed): one cache across versions, so a page saved before a
// deploy still finds its scripts after the new worker takes over. Oldest dropped past MAX_ASSETS.
const ASSETS = "keepup-assets";
const MAX_ASSETS = 300;
const PAGES = "keepup-pages"; // the last Today and kid view, on this device only; cleared at sign-out
const OFFLINE_URL = "/offline";
const OFFLINE_PAGES = [/^\/today$/, /^\/kids\/[0-9a-f-]{36}\/play$/];

// The offline page is saved up front, but a failure (installed while offline) must not hold the
// update back: it is saved again on the next page load that works.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll([OFFLINE_URL, "/icons/icon-192.png"]).then(() => c.match(OFFLINE_URL)))
      .then((page) => page && page.text().then(saveAssetsOf))
      .catch((e) => console.error("offline precache", e))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("keepup-shell-") && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Only same-origin GETs. API calls, server actions (POST) and Next's own data requests go straight to
// the network. Built assets never change under one URL: cache first. Pages: always fresh when online;
// the saved copy (Today, the kid view) or the offline page only when the network fails.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(event, req, ASSETS));
    return;
  }
  if (url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(event, req, SHELL));
    return;
  }
  if (req.mode === "navigate") event.respondWith(networkFirstPage(event, req, url));
});

async function cacheFirst(event, req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) event.waitUntil(cache.put(req, res.clone()).then(() => name === ASSETS && prune(cache)).catch(() => undefined));
  return res;
}

// Every 25th save (listing a few hundred keys on every asset would slow the page's first load).
let sincePrune = 0;
async function prune(cache) {
  if (++sincePrune < 25) return;
  sincePrune = 0;
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map((k) => cache.delete(k)));
}

const isSaved = (pathname) => OFFLINE_PAGES.some((p) => p.test(pathname));

// Saves of one page can overlap (a navigation, then a save after a check-in): only the one asked for
// last may write, so a slow older answer never replaces a newer copy.
const lastSave = new Map();
function nextSave(pathname) {
  const n = (lastSave.get(pathname) || 0) + 1;
  lastSave.set(pathname, n);
  return () => lastSave.get(pathname) === n;
}
async function putIfLatest(pathname, res, isLatest) {
  if (!isLatest()) return;
  // Its scripts first: a saved page always has what it needs.
  await saveAssetsOf(await res.clone().text());
  if (isLatest()) await (await caches.open(PAGES)).put(pathname, res);
}

// A saved page needs every script it may load offline, including ones loaded only on demand (a card
// that shows after a check-in). Next lists them in the page (its flight data); save the missing ones.
async function saveAssetsOf(html) {
  const paths = new Set((html.match(/static\/(?:chunks|css|media)\/[\w.~-]+/g) || []).map((p) => `/_next/${p}`));
  const cache = await caches.open(ASSETS);
  await Promise.all(
    [...paths].map(async (p) => {
      if (await cache.match(p)) return;
      try {
        const res = await fetch(p);
        if (res.ok) await cache.put(p, res);
      } catch {
        // offline again: the next save tries
      }
    }),
  );
}

async function networkFirstPage(event, req, url) {
  const keep = isSaved(url.pathname);
  const isLatest = keep && url.search === "" ? nextSave(url.pathname) : null;
  try {
    const res = await fetch(req);
    if (res.ok) {
      // A redirect (signed out: to /login) is never saved as Today. With a query (/today?joined=…,
      // a one-time welcome), the plain page is fetched and saved instead.
      if (isLatest && !res.redirected) {
        event.waitUntil(track(putIfLatest(url.pathname, res.clone(), isLatest)));
      } else if (keep && !res.redirected) {
        event.waitUntil(track(savePage(url.pathname)));
      }
      event.waitUntil(saveOfflinePage());
    }
    return res;
  } catch {
    const saved = keep ? await (await caches.open(PAGES)).match(url.pathname) : undefined;
    return saved || (await (await caches.open(SHELL)).match(OFFLINE_URL)) || Response.error();
  }
}

// Page saves in progress: sign-out waits for them before clearing, so none lands after it.
const saving = new Set();
function track(p) {
  const t = Promise.resolve(p)
    .catch(() => undefined)
    .finally(() => saving.delete(t));
  saving.add(t);
  return t;
}

// The page asks for a save when it was reached by client-side navigation (no navigation request came
// through here), and again after a check-in so the offline copy isn't stale. Same rules as above:
// same origin, Today or a kid view only, the plain path, an ok answer that isn't a redirect.
async function savePage(path) {
  let url;
  try {
    url = new URL(path, self.location.origin);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin || !isSaved(url.pathname)) return;
  const isLatest = nextSave(url.pathname);
  try {
    const res = await fetch(url.pathname, { credentials: "same-origin" });
    if (res.ok && !res.redirected) await putIfLatest(url.pathname, res, isLatest);
  } catch {
    // offline: keep the copy there is
  }
}

// Sign-out (components/sign-out-button.tsx): wait for saves in flight, then clear every cache, then
// answer on the port the page gave.
async function clearAll() {
  await Promise.all([...saving]);
  const keys = await caches.keys();
  await Promise.all(keys.map((k) => caches.delete(k)));
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "keepup:save-page" && typeof data.path === "string") {
    event.waitUntil(track(savePage(data.path)));
  } else if (data.type === "keepup:clear") {
    const port = event.ports && event.ports[0];
    event.waitUntil(clearAll().then(() => port && port.postMessage("cleared")));
  }
});

// Sign-out clears every cache (lib/push-support.ts signOutCleanup); put the offline page back.
async function saveOfflinePage() {
  try {
    const cache = await caches.open(SHELL);
    if (await cache.match(OFFLINE_URL)) return;
    const res = await fetch(OFFLINE_URL);
    if (!res.ok) return;
    // Its scripts first, as for any saved page (the offline page has its own).
    await saveAssetsOf(await res.clone().text());
    await cache.put(OFFLINE_URL, res);
  } catch {
    // offline again, or the page failed: next time
  }
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Keepup", {
      body: data.body || "",
      tag: data.tag || undefined,
      // Silent unless the person chose Sound (send-push says silent: false). Android Chrome and desktop
      // browsers honour it; iPhone Safari ignores it (one Sounds switch per app in iOS Settings).
      // renotify only with a tag (Chrome throws otherwise) and only when it may ring.
      silent: data.silent !== false,
      renotify: Boolean(data.tag) && data.silent === false,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/inbox", checkInId: data.checkInId || null, version: VERSION },
      actions: Array.isArray(data.actions) ? data.actions : [],
    }),
  );
});

// A window already showing the url is focused; otherwise one of ours is moved there; failing that (it
// isn't controlled by this worker, or navigate throws), a new window opens. Never rejects, so
// waitUntil doesn't either.
async function openOrFocus(url) {
  try {
    const target = new URL(url, self.location.origin).href;
    const windows = (await self.clients.matchAll({ type: "window", includeUncontrolled: true })).filter(
      (w) => new URL(w.url).origin === self.location.origin,
    );
    const there = windows.find((w) => w.url === target);
    if (there) {
      await there.focus();
      return;
    }
    const w = windows[0];
    if (w && "navigate" in w) {
      try {
        const moved = await w.navigate(target);
        if (moved) {
          await moved.focus();
          return;
        }
      } catch {
        // fall through to a new window
      }
    }
    await self.clients.openWindow(target);
  } catch (e) {
    console.error("notification click", e);
  }
}

// Android and desktop show the buttons; iPhone has none, so a tap opens the url (/inbox for approvals).
self.addEventListener("notificationclick", (event) => {
  const { url, checkInId } = event.notification.data || {};
  event.notification.close();
  if ((event.action === "approve" || event.action === "reject") && checkInId) {
    event.waitUntil(
      fetch(`/api/check-ins/${checkInId}/review`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve: event.action === "approve" }),
      }).then(
        (res) => (res.ok ? undefined : openOrFocus("/inbox")),
        () => openOrFocus("/inbox"),
      ),
    );
    return;
  }
  event.waitUntil(openOrFocus(url || "/inbox"));
});

// The browser replaced this device's subscription (expired or rotated keys). Subscribe again with the
// old one's options and save it, with the endpoint it replaces: the server saves it only while this
// account still has that device. Without the old subscription there is nothing to go on, so nothing
// is done. If anything fails, do nothing. Never rejects, so waitUntil doesn't either.
async function resubscribe(event) {
  try {
    const old = event.oldSubscription;
    if (!old || !old.endpoint) return;
    const options = old.options;
    let sub = event.newSubscription || null;
    if (!sub) {
      if (!options || !options.applicationServerKey) return;
      sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: options.applicationServerKey });
    }
    const json = sub.toJSON();
    await fetch("/api/push-subscription", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        p256dh: json.keys && json.keys.p256dh,
        auth: json.keys && json.keys.auth,
        oldEndpoint: old.endpoint,
      }),
    });
  } catch (e) {
    console.error("push resubscribe", e);
  }
}

self.addEventListener("pushsubscriptionchange", (event) => event.waitUntil(resubscribe(event)));
