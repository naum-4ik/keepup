"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import {
  TOAST_COOKIE,
  dismissToast,
  emptyToasts,
  flashFromCookieString,
  isFreshFlash,
  parseFlash,
  pushToast,
  removeToast,
  toastDuration,
  type Flash,
  type Toast,
  type ToastAction,
  type ToastState,
} from "@/lib/toast";

// The status toast (docs/design.md "Feedback"; how to use it: lib/toast.ts). One store for the page,
// so showToast works from any client component without a provider.
let state: ToastState = emptyToasts;
const listeners = new Set<() => void>();
function setState(next: ToastState) {
  if (next === state) return;
  state = next;
  for (const l of listeners) l();
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
const getState = () => state;
const getServerState = () => emptyToasts;

let seq = 0;
// Flash ids already shown on this page load: a flash that comes back (an older render's props, the
// cookie read twice) never shows twice.
const shownFlashes = new Set<string>();
// `text`: already translated. `action`: a link ({ label, href }) or a callback ({ label, onAction }).
export function showToast({ text, action, id, sticky }: { text: string; action?: ToastAction; id?: string; sticky?: boolean }): void {
  setState(pushToast(state, { id: id ?? `toast-${++seq}`, text, action, ...(sticky ? { sticky } : {}) }));
}

// Closes this toast if it is the one showing, or drops it if it waits (an "Undoing…" toast once the
// undo has answered, so the answer shows at once instead of queueing behind it).
export function closeToast(id: string): void {
  setState(removeToast(state, id));
}

export function useToast(): { showToast: typeof showToast; closeToast: typeof closeToast } {
  return { showToast, closeToast };
}

// In the app layout. `flash`: the flash cookie as the server read it (after a server action that set
// it, Next renders the layout again, so this arrives with the redirect). The cookie is also read from
// document.cookie when the address changes, in case the layout was not part of that render.
export function Toaster({ flash }: { flash?: string | null }) {
  const { t } = useT();
  const tr = useTranslations();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const current = useSyncExternalStore(subscribe, getState, getServerState).current;

  const showFlash = useCallback(
    (f: Flash | null) => {
      // Clear first: a flash shows once, even if its key is unknown here.
      document.cookie = `${TOAST_COOKIE}=; path=/; max-age=0; samesite=lax`;
      // Fail soft on a key this build doesn't have (or one outside the client namespaces).
      if (!f || !isFreshFlash(f, Date.now()) || shownFlashes.has(f.id) || !tr.has(f.text as never) || (f.action && !tr.has(f.action.label as never))) return;
      shownFlashes.add(f.id);
      showToast({
        id: f.id,
        text: t(f.text, f.values),
        action: f.action && { label: t(f.action.label), href: f.action.href },
      });
    },
    [t, tr],
  );

  useEffect(() => {
    if (flash) showFlash(parseFlash(flash));
  }, [flash, showFlash]);

  useEffect(() => {
    const raw = flashFromCookieString(document.cookie);
    if (raw) showFlash(parseFlash(raw));
  }, [pathname, search, showFlash]);

  return (
    // Above the bottom nav and its safe-area inset; z-50 like dialogs.
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--nav-height)+env(safe-area-inset-bottom)+0.5rem)] z-50 mx-auto flex max-w-md justify-center px-4"
    >
      {/* The live region holds the words only, and is always in the page (a region that appears is not
          announced), so a new toast is read once without its buttons. */}
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {current?.text}
      </p>
      {current && <ToastView key={current.id} toast={current} dismissLabel={t("common.dismiss")} />}
    </div>
  );
}

function ToastView({ toast, dismissLabel }: { toast: Toast; dismissLabel: string }) {
  const [paused, setPaused] = useState(false);
  const left = useRef(toastDuration(toast));
  const close = useCallback(() => setState(dismissToast(state, toast.id)), [toast.id]);

  // Counts down while not hovered or focused; picks up where it left off. A sticky toast never does.
  useEffect(() => {
    const ms = left.current;
    if (paused || ms === null) return;
    const started = Date.now();
    const timer = setTimeout(close, ms);
    return () => {
      clearTimeout(timer);
      left.current = ms - (Date.now() - started);
    };
  }, [paused, close]);

  const action = toast.action;
  const actionClass = "-my-2 flex min-h-11 shrink-0 items-center rounded-lg px-2 font-bold underline underline-offset-2 hover:bg-background/10";
  return (
    <div
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex w-full items-center gap-inner rounded-xl bg-foreground py-2 ps-4 pe-1 text-sm font-semibold text-background shadow-soft motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
    >
      {/* Read from the live region above; hidden here so it isn't read twice. */}
      <p aria-hidden className="min-w-0 flex-1">
        {toast.text}
      </p>
      {action &&
        ("href" in action ? (
          <Link href={action.href} onClick={close} className={actionClass}>
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => {
              close();
              action.onAction();
            }}
            className={actionClass}
          >
            {action.label}
          </button>
        ))}
      <button type="button" onClick={close} aria-label={dismissLabel} className="-my-2 flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-background/10">
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}
