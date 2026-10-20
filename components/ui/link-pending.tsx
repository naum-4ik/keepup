"use client";

import { useLinkStatus } from "next/link";

// A tapped card (a habit, a group) answers at once while its page loads: a soft tint over the card,
// fading in and out (only when the page wasn't prefetched yet; a prefetched one shows its loading screen
// at once). Put it inside the <Link> (useLinkStatus reads the Link it sits in); it fills the nearest
// positioned ancestor, which is the card (rounded-2xl, as Surface). Nothing shifts: it's an overlay.
export function LinkPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <span aria-hidden data-pending="" className="pointer-events-none absolute inset-0 rounded-2xl bg-foreground/5 motion-safe:animate-pulse" />;
}
