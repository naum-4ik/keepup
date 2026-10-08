"use client";

import { useEffect } from "react";
import { markRead } from "@/app/(app)/inbox/actions";

// Mounted only while the Activity tab shows: after 1.5s on screen, the unread rows it rendered
// count as read. If the page is in the background then, it waits until it's visible again.
export function MarkReadOnView({ ids }: { ids: string[] }) {
  const key = ids.join(",");
  useEffect(() => {
    if (!key) return;
    let timer: number | null = null;
    const arm = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        if (document.visibilityState === "visible") {
          document.removeEventListener("visibilitychange", onVisible);
          void markRead(key.split(","));
        }
      }, 1500);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") arm();
      else if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    arm();
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (timer) window.clearTimeout(timer);
    };
  }, [key]);
  return null;
}
