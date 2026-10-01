// components/pwa/service-worker.tsx
"use client";

import { useEffect } from "react";

// Registers /sw.js. A new worker takes over at once (skipWaiting + clients.claim in sw.js); if that
// happens while the app is open, the page reloads the next time it's hidden, never in the middle of a
// tap (ideas/installable-app.md). Queued check-ins live in IndexedDB, so a reload loses nothing.
export function ServiceWorker({ version }: { version: string }) {
  useEffect(() => {
    // Production builds only: in `next dev` chunk URLs aren't content-hashed per edit, so a
    // cache-first worker would serve stale code. E2E runs `next build && next start`, so it has it.
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const hadController = Boolean(navigator.serviceWorker.controller);
    let updated = false;
    const onController = () => {
      if (hadController) updated = true;
    };
    const onVisibility = () => {
      if (updated && document.visibilityState === "hidden") window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onController);
    document.addEventListener("visibilitychange", onVisibility);
    navigator.serviceWorker
      .register(`/sw.js?v=${encodeURIComponent(version)}`, { scope: "/" })
      .catch((e: unknown) => console.error("service worker registration failed", e));
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onController);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [version]);
  return null;
}
