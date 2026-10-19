// Status toasts (docs/design.md "Feedback"): the queue and the flash cookie, kept free of React and
// Next so they are unit-tested (lib/toast.test.ts). The component is components/ui/toast.tsx; the
// server side is lib/toast-server.ts.
//
// Two ways in:
// - On the same page, in a client component after an action resolves: useToast().showToast({ text,
//   action }) with translated text. The action can be a link ({ label, href }) or a callback
//   ({ label, onAction }: Undo).
// - From a server action that redirects: flashToast({ text, values, action }) in lib/toast-server.ts,
//   then redirect(). It sets a short-lived cookie with catalog keys; the app layout hands it to the
//   Toaster, which shows it on the next page and clears it. A callback can't cross a redirect, so a
//   flash action is a link only.

export const TOAST_COOKIE = "keepup-toast";
// Seconds the flash cookie lives: long enough for the redirect, short enough that a lost one goes.
export const TOAST_COOKIE_MAX_AGE = 60;
const MAX_COOKIE_CHARS = 1024;
// One showing, at most this many waiting; older waiting ones drop (a burst of taps never piles up).
export const MAX_WAITING = 2;

export type ToastAction = { label: string; href: string } | { label: string; onAction: () => void };

// A toast ready to show: translated text. sticky: stays until its owner closes it (closeToast), for a
// state that must not vanish before its answer ("Undoing…"); the X still closes it.
// focusAction: its action takes focus when it shows (a retry after an error, where focus was on the
// button that went away).
export type Toast = { id: string; text: string; action?: ToastAction; sticky?: boolean; focusAction?: boolean };

export type ToastState = { current: Toast | null; waiting: Toast[] };

export const emptyToasts: ToastState = { current: null, waiting: [] };

// Shown at once when nothing is showing, else queued. The same id twice (a flash read on the server
// render and again from the cookie) is shown once.
export function pushToast(state: ToastState, toast: Toast): ToastState {
  if (state.current?.id === toast.id || state.waiting.some((t) => t.id === toast.id)) return state;
  if (!state.current) return { current: toast, waiting: state.waiting };
  return { current: state.current, waiting: [...state.waiting, toast].slice(-MAX_WAITING) };
}

// The showing toast closes (timer, X, or its action) and the next waiting one shows. An id that is
// not the current one changes nothing (a late timer of a toast already gone).
export function dismissToast(state: ToastState, id: string): ToastState {
  if (state.current?.id !== id) return state;
  const [next = null, ...rest] = state.waiting;
  return { current: next, waiting: rest };
}

// A toast closed by its owner (an "Undoing…" toast once the undo answered): the showing one closes
// as dismissToast does, a waiting one is dropped. An unknown id changes nothing.
export function removeToast(state: ToastState, id: string): ToastState {
  if (state.current?.id === id) return dismissToast(state, id);
  if (!state.waiting.some((t) => t.id === id)) return state;
  return { current: state.current, waiting: state.waiting.filter((t) => t.id !== id) };
}

// How long a toast stays: longer with an action, so there is time to reach it (WCAG 2.2.1; the
// toast also pauses while hovered or focused).
// null: sticky, no timer.
export function toastDuration(toast: Pick<Toast, "action" | "sticky">): number | null {
  if (toast.sticky) return null;
  return toast.action ? 8000 : 5000;
}

// An in-app path only: "/habits/1", not "//evil.example", "/\evil", "https://…" or "javascript:".
export function isSafeHref(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/\\") && !/[\s\u0000-\u001f]/.test(href);
}

// Catalog keys only ("habits.toast.added"): the cookie is writable by the page, so its text is never
// shown as is.
const KEY = /^[A-Za-z][\w-]*(\.[\w-]+)+$/;

export type FlashValues = Record<string, string | number>;

// What crosses the redirect: catalog keys and their values, translated by the Toaster. `at`: when it
// was set (ms since epoch), so a flash older than the cookie's life is dropped even if the cookie stayed.
export type Flash = { id: string; at: number; text: string; values?: FlashValues; action?: { label: string; href: string } };

// Fresh: set within the cookie's life (and not from the future beyond a minute of clock skew).
export function isFreshFlash(flash: Pick<Flash, "at">, now: number): boolean {
  return flash.at <= now + 60_000 && now - flash.at <= TOAST_COOKIE_MAX_AGE * 1000;
}

// The cookie value: plain JSON. Next's cookies().set URI-encodes it on the way out and cookies().get
// decodes it, so the server reads JSON and document.cookie reads it encoded; parseFlash takes both.
export function serializeFlash(flash: Flash): string {
  return JSON.stringify(flash);
}

function isValues(v: unknown): v is FlashValues {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  return Object.values(v).every((x) => typeof x === "string" || (typeof x === "number" && Number.isFinite(x)));
}

// The cookie's value (JSON, or URI-encoded JSON from document.cookie) back to a Flash, or null when
// it is missing, too long, malformed, names a non-key text or points the action off the site.
export function parseFlash(raw: string | null | undefined): Flash | null {
  if (!raw || raw.length > MAX_COOKIE_CHARS * 3) return null;
  let v: unknown;
  try {
    const json = raw.startsWith("{") ? raw : decodeURIComponent(raw);
    if (json.length > MAX_COOKIE_CHARS) return null;
    v = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof v !== "object" || v === null) return null;
  const { id, at, text, values, action } = v as Record<string, unknown>;
  if (typeof id !== "string" || !id || id.length > 64) return null;
  if (typeof at !== "number" || !Number.isFinite(at)) return null;
  if (typeof text !== "string" || !KEY.test(text)) return null;
  if (values !== undefined && !isValues(values)) return null;
  let safeAction: Flash["action"];
  if (action !== undefined) {
    const { label, href } = (action ?? {}) as Record<string, unknown>;
    if (typeof label !== "string" || !KEY.test(label) || typeof href !== "string" || !isSafeHref(href)) return null;
    safeAction = { label, href };
  }
  return { id, at, text, ...(values ? { values } : {}), ...(safeAction ? { action: safeAction } : {}) };
}

// The flash cookie's raw value from a `document.cookie` string, or null.
export function flashFromCookieString(cookie: string): string | null {
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === TOAST_COOKIE) return rest.join("=") || null;
  }
  return null;
}
