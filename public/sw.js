// public/sw.js
// Keepup's one service worker (ideas/installable-app.md). PR 4: push and notification taps.
// PR 10 adds the offline app shell and sync messages. Plain JS, not bundled; keep it small.
// The version comes from the registration URL (/sw.js?v=<commit>), so every deploy installs anew.
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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
      renotify: Boolean(data.tag),
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
