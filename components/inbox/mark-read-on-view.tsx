"use client";

import { useEffect } from "react";
import { markAllRead } from "@/app/(app)/inbox/actions";

// Mounted only while the Activity tab shows: after 1.5s on screen, everything counts as read.
export function MarkReadOnView({ hasUnread }: { hasUnread: boolean }) {
  useEffect(() => {
    if (!hasUnread) return;
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") void markAllRead();
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [hasUnread]);
  return null;
}
