"use client";

import { useSyncExternalStore } from "react";

// Browser state the kid view's motion follows. Both render "motion off, page hidden" on the server, so
// nothing moves until the client knows better.

const REDUCE = "(prefers-reduced-motion: reduce)";
const subscribeReduce = (cb: () => void) => {
  const q = window.matchMedia(REDUCE);
  q.addEventListener("change", cb);
  return () => q.removeEventListener("change", cb);
};
export const useReducedMotion = (): boolean =>
  useSyncExternalStore(subscribeReduce, () => window.matchMedia(REDUCE).matches, () => true);

// No idle timers while the tab is hidden (battery).
const subscribeVisible = (cb: () => void) => {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
};
export const usePageVisible = (): boolean =>
  useSyncExternalStore(subscribeVisible, () => document.visibilityState === "visible", () => false);
