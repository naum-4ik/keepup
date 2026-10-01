// components/notifications/push-refresh.tsx
"use client";

import { useEffect } from "react";
import { refreshPushSubscription } from "@/app/(app)/profile/settings/notification-actions";
import { resaveOncePerLoad } from "@/lib/push-support";

// Module scope, so it runs once per page load, not once per mount.
const resave = resaveOncePerLoad({
  permission: () => ("Notification" in window ? Notification.permission : "unsupported"),
  getSubscription: async () => {
    if (!("serviceWorker" in navigator)) return null;
    return (await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription()) ?? null;
  },
  save: (keys) => refreshPushSubscription({ ...keys, userAgent: navigator.userAgent }),
});

// An active phone saves its subscription again when the app opens, so the 10-device cap never drops it.
export function PushRefresh() {
  useEffect(() => {
    void resave();
  }, []);
  return null;
}
