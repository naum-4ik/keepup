"use client";

import { useEffect, useSyncExternalStore } from "react";
import { X } from "lucide-react";

// One-time hint under the first check-in button on Today. Dismissed by tapping it or by any
// check-in, and remembered in localStorage. Without storage (private mode, blocked site data) it
// is remembered for this page session only, so it shows once per session.
const KEY = "keepup:tip-first-checkin";
// The local day the tip went away, so other Today hints wait until tomorrow (one hint at a time).
const DAY_KEY = "keepup:tip-first-checkin-day";
let dismissedThisSession = false;
// True while the tip is on screen, so a check-in by someone who never saw it doesn't count as
// "the tip went away today".
let tipOnScreen = false;
let goneThisSession = false;
const listeners = new Set<() => void>();

function isDismissed(): boolean {
  if (dismissedThisSession) return true;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function dismissFirstCheckinTip() {
  if (dismissedThisSession) return;
  const wasShowing = tipOnScreen;
  dismissedThisSession = true;
  if (wasShowing) goneThisSession = true;
  try {
    window.localStorage.setItem(KEY, "1");
    if (wasShowing) window.localStorage.setItem(DAY_KEY, localDay());
  } catch {
    // Storage unavailable: the in-memory flags cover this session.
  }
  listeners.forEach((l) => l());
}

function localDay(): string {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in the device's time zone
}

export function firstCheckinTipGoneToday(): boolean {
  if (goneThisSession) return true;
  try {
    return window.localStorage.getItem(DAY_KEY) === localDay();
  } catch {
    return false;
  }
}

export function FirstCheckinTip() {
  // The server snapshot says "dismissed", so the tip only appears after hydration reads storage.
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => true);
  useEffect(() => {
    if (dismissed) return;
    tipOnScreen = true;
    return () => {
      tipOnScreen = false;
    };
  }, [dismissed]);
  if (dismissed) return null;

  return (
    <div className="flex justify-end pt-2.5">
      <button
        type="button"
        onClick={dismissFirstCheckinTip}
        className="relative flex min-h-11 items-center gap-2 rounded-xl bg-primary py-2 pr-3 pl-4 text-sm font-semibold text-primary-foreground shadow-soft hover:brightness-95"
      >
        {/* Points up at the check-in button (card padding + half the 44px button, minus half the arrow). */}
        <span aria-hidden className="absolute -top-1.5 right-[1.875rem] size-3 rotate-45 rounded-[2px] bg-primary" />
        <span className="sr-only">Dismiss tip: </span>
        <span>Tap when you&apos;ve done it</span>
        <X aria-hidden className="size-4 opacity-80" />
      </button>
    </div>
  );
}
