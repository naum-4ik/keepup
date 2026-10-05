"use client";

import { useSyncExternalStore } from "react";

// The "+10 XP" float of a check-in, kept outside the button: the refresh after a check-in can move the
// habit's card (Today's "Done for today" list) and remount its button, which would cut the float short.
// Keyed by habit; one float per habit at a time, gone after the 900 ms animation.
export const XP_FLOAT_MS = 900;
type Float = { xp: number; id: number };
const floats = new Map<string, Float>();
const listeners = new Set<() => void>();
let next = 0;
const emit = () => listeners.forEach((l) => l());

export function floatXp(habitId: string, xp: number) {
  const id = ++next;
  floats.set(habitId, { xp, id });
  emit();
  window.setTimeout(() => {
    if (floats.get(habitId)?.id !== id) return;
    floats.delete(habitId);
    emit();
  }, XP_FLOAT_MS);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function useXpFloat(habitId: string): Float | undefined {
  return useSyncExternalStore(subscribe, () => floats.get(habitId), () => undefined);
}
