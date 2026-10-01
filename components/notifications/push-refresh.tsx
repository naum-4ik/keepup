// components/notifications/push-refresh.tsx
"use client";

import { useEffect } from "react";
import { browserSubscription, resaveOncePerLoad } from "@/lib/push-support";

// Module scope, so it runs once per page load, not once per mount. A plain fetch, not a server action:
// it must never queue ahead of the person's first tap. The route saves only a device this account
// still has (a removed one stays removed).
const resave = resaveOncePerLoad({
  permission: () => ("Notification" in window ? Notification.permission : "unsupported"),
  getSubscription: browserSubscription,
  save: (keys) =>
    fetch("/api/push-subscription", {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...keys, refresh: true }),
    }),
});

// An active phone saves its subscription again when the app opens, so the 10-device cap never drops it.
export function PushRefresh() {
  useEffect(() => {
    void resave();
  }, []);
  return null;
}
