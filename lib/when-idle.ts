// Runs `run` once the page has finished loading and the browser is idle, so work that isn't needed for
// the first screen (telemetry, a script the page may need later) never competes with it. Without
// requestIdleCallback (Safari) a short timeout stands in. Returns a cancel, for effect cleanups.
type IdleWindow = Pick<Window, "addEventListener" | "removeEventListener" | "setTimeout" | "clearTimeout"> & {
  document: Pick<Document, "readyState">;
  requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

// The longest the work waits for an idle moment once the page has loaded.
export const IDLE_TIMEOUT_MS = 2000;
const FALLBACK_DELAY_MS = 200;

export function whenIdle(run: () => void, win: IdleWindow = window): () => void {
  let cancelled = false;
  let cancelPending = () => {};

  const schedule = () => {
    if (cancelled) return;
    if (win.requestIdleCallback) {
      const handle = win.requestIdleCallback(() => !cancelled && run(), { timeout: IDLE_TIMEOUT_MS });
      cancelPending = () => win.cancelIdleCallback?.(handle);
    } else {
      const handle = win.setTimeout(() => !cancelled && run(), FALLBACK_DELAY_MS);
      cancelPending = () => win.clearTimeout(handle);
    }
  };

  if (win.document.readyState === "complete") schedule();
  else {
    const onLoad = () => schedule();
    win.addEventListener("load", onLoad, { once: true });
    cancelPending = () => win.removeEventListener("load", onLoad);
  }

  return () => {
    cancelled = true;
    cancelPending();
  };
}
