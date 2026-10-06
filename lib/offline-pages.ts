// lib/offline-pages.ts
// The page's side of the saved offline pages (public/sw.js "keepup-pages"). Browser only.

const PAGES = "keepup-pages";
// Who the saved pages belong to, on this device.
const OWNER = "keepup-pages-owner";

// Ask the worker to save this page (reached by client-side navigation, or changed by a check-in).
// The worker decides whether it is a page it keeps.
export function savePageOffline(path = window.location.pathname): void {
  navigator.serviceWorker?.controller?.postMessage({ type: "keepup:save-page", path });
}

// A shared phone: if someone else's saved Today or kid view is still here (their session ended without
// signing out), delete it before anything is saved for this person. Resolves once it's safe to save.
export async function claimSavedPages(userId: string): Promise<void> {
  try {
    const owner = localStorage.getItem(OWNER);
    if (owner && owner !== userId && "caches" in window) await caches.delete(PAGES);
    localStorage.setItem(OWNER, userId);
  } catch {
    // no storage (private mode): nothing was saved under another name either
  }
}

// Sign-out: the worker finishes saves in flight, then clears every cache (so none lands after);
// the page clears too, in case no worker controls it or it doesn't answer in time.
export async function clearOfflineCaches(timeoutMs = 3000): Promise<void> {
  const worker = navigator.serviceWorker?.controller;
  if (worker) {
    await new Promise<void>((resolve) => {
      const channel = new MessageChannel();
      const timer = window.setTimeout(resolve, timeoutMs);
      channel.port1.onmessage = () => {
        window.clearTimeout(timer);
        resolve();
      };
      worker.postMessage({ type: "keepup:clear" }, [channel.port2]);
    });
  }
  if ("caches" in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
}

// Reset my data: the saved Today and kid view show habits that are about to go. The next visit saves
// them again.
export async function clearSavedPages(): Promise<void> {
  try {
    if ("caches" in window) await caches.delete(PAGES);
  } catch {
    // no Cache Storage here: nothing was saved
  }
}
