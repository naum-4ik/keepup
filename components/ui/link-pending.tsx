"use client";

import { useLinkStatus } from "next/link";
import { cn } from "@/lib/utils";

// A tapped card (a habit, a group) answers at once while its page loads: a soft tint over the card,
// fading in and out (only when the page wasn't prefetched yet; a prefetched one shows its loading screen
// at once). Put it inside the <Link> (useLinkStatus reads the Link it sits in); it fills the nearest
// positioned ancestor, which is the card (rounded-2xl, as Surface). Nothing shifts: it's an overlay.
// `className`: the shape when it isn't a card's (a tab pill, a round arrow).
export function LinkPending({ className = "rounded-2xl" }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <span aria-hidden data-pending="" className={cn("pointer-events-none absolute inset-0 bg-foreground/5 motion-safe:animate-pulse", className)} />;
}
