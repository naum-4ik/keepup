// lib/push-support.ts
// Whether this device can get Web Push, and why not (spec: Pipeline; ideas/onboarding.md). iPhone
// allows push only from iOS 16.4, and only once Keepup is on the Home Screen.

export type PushSupport = "ready" | "needs-install" | "ios-too-old" | "unsupported" | "blocked" | "not-configured";

export type PushEnv = {
  userAgent: string;
  maxTouchPoints: number;
  standalone: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  permission: NotificationPermission | "unsupported";
  vapidKey: string | undefined;
};

// iPadOS asks for desktop sites by default and says "Macintosh"; a touch screen gives it away.
export function iosVersion(userAgent: string, maxTouchPoints: number): [number, number] | null {
  const apple = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  if (!apple) return null;
  const m = userAgent.match(/OS (\d+)_(\d+)/) ?? userAgent.match(/Version\/(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : [0, 0];
}

export function pushSupport(env: PushEnv): PushSupport {
  if (!env.vapidKey) return "not-configured";
  const ios = iosVersion(env.userAgent, env.maxTouchPoints);
  if (ios) {
    if (ios[0] < 16 || (ios[0] === 16 && ios[1] < 4)) return "ios-too-old";
    if (!env.standalone) return "needs-install";
  }
  if (!env.hasServiceWorker || !env.hasPushManager || env.permission === "unsupported") return "unsupported";
  if (env.permission === "denied") return "blocked";
  return "ready";
}

export const PUSH_SUPPORT_TEXT: Record<Exclude<PushSupport, "ready">, string> = {
  "needs-install": "On iPhone, reminders work once Keepup is on your Home Screen.",
  "ios-too-old": "Reminders need iOS 16.4 or later. You can update in Settings → General → Software Update.",
  unsupported: "This browser can't show notifications. Try Chrome, or Safari on iPhone.",
  blocked: "Notifications are turned off for Keepup. You can allow them in your browser or phone settings.",
  "not-configured": "Notifications aren't set up here yet.",
};

export function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return "A device";
  const os = /iPhone/.test(userAgent) ? "iPhone"
    : /iPad/.test(userAgent) ? "iPad"
    : /Android/.test(userAgent) ? "Android"
    : /Macintosh|Mac OS X/.test(userAgent) ? "Mac"
    : /Windows/.test(userAgent) ? "Windows"
    : /Linux/.test(userAgent) ? "Linux"
    : "A device";
  const browser = /Edg\//.test(userAgent) ? "Edge"
    : /CriOS|Chrome\//.test(userAgent) ? "Chrome"
    : /Firefox|FxiOS/.test(userAgent) ? "Firefox"
    : /Safari\//.test(userAgent) ? "Safari"
    : null;
  return browser ? `${os} · ${browser}` : os;
}

export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// A phone shared by two accounts: signing out must stop this account's pushes here.
export async function signOutCleanup(deps: {
  getSubscription(): Promise<{ endpoint: string; unsubscribe(): Promise<boolean> } | null>;
  forget(endpoint: string): Promise<void>;
  clearCaches(): Promise<void>;
}): Promise<void> {
  try {
    const sub = await deps.getSubscription();
    if (sub) {
      await deps.forget(sub.endpoint).catch(() => undefined);
      await sub.unsubscribe().catch(() => false);
    }
  } catch {
    // No service worker here: nothing to unsubscribe.
  }
  await deps.clearCaches().catch(() => undefined);
}

export function readPushEnv(): PushEnv {
  const nav = navigator as Navigator & { standalone?: boolean };
  return {
    userAgent: nav.userAgent,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    standalone: window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true,
    hasServiceWorker: "serviceWorker" in nav,
    hasPushManager: "PushManager" in window,
    permission: "Notification" in window ? Notification.permission : "unsupported",
    vapidKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || undefined,
  };
}

// What a browser push subscription gives us (PushSubscription, or a stand-in in tests).
export type BrowserSubscription = { endpoint: string; toJSON(): PushSubscriptionJSON; unsubscribe(): Promise<boolean> };
export type SubscriptionKeys = { endpoint: string; p256dh: string; auth: string };
type SaveResult = { ok: true } | { ok: false; message: string; code?: string };

export function subscriptionKeys(sub: BrowserSubscription): SubscriptionKeys {
  const json = sub.toJSON();
  return { endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" };
}

// This browser's subscription (or a new one) is saved for this account. The database refuses an
// endpoint another account holds with other keys (invalid_subscription); then a fresh subscription
// gets one more try, never more.
export async function subscribeAndSave(deps: {
  current(): Promise<BrowserSubscription | null>;
  subscribe(): Promise<BrowserSubscription>;
  save(keys: SubscriptionKeys): Promise<SaveResult>;
}): Promise<SaveResult> {
  const sub = (await deps.current()) ?? (await deps.subscribe());
  const saved = await deps.save(subscriptionKeys(sub));
  if (saved.ok || saved.code !== "invalid_subscription") return saved;
  await sub.unsubscribe().catch(() => false);
  return deps.save(subscriptionKeys(await deps.subscribe()));
}

// The app-open re-save (see refreshPushSubscription): at most once per page load, whatever calls it
// (React runs effects twice in development). Never throws.
export function resaveOncePerLoad(deps: {
  permission(): NotificationPermission | "unsupported";
  getSubscription(): Promise<BrowserSubscription | null>;
  save(keys: SubscriptionKeys): Promise<unknown>;
}): () => Promise<void> {
  let started = false;
  return async () => {
    if (started) return;
    started = true;
    try {
      if (deps.permission() !== "granted") return;
      const sub = await deps.getSubscription();
      if (sub) await deps.save(subscriptionKeys(sub));
    } catch (e) {
      console.error("push re-save failed", e);
    }
  };
}

// This browser's push subscription, or null: no worker, no registration, or the browser says no.
// Browser only. Never throws.
export async function browserSubscription(): Promise<PushSubscription | null> {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
    const reg = await navigator.serviceWorker.getRegistration();
    return (await reg?.pushManager?.getSubscription().catch(() => null)) ?? null;
  } catch {
    return null;
  }
}

// Rejects after `ms` (e.g. a service worker that never becomes ready).
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Devices → Remove. Removing this device also ends its browser subscription, so nothing saves it
// again (the re-save on open, or a later rotation). Another device's subscription isn't ours to end.
export async function removeDevice(deps: {
  endpoint: string;
  here: string | null;
  forget(endpoint: string): Promise<SaveResult>;
  getSubscription(): Promise<BrowserSubscription | null>;
}): Promise<SaveResult> {
  const r = await deps.forget(deps.endpoint);
  if (r.ok && deps.endpoint === deps.here) {
    try {
      const sub = await deps.getSubscription();
      if (sub?.endpoint === deps.endpoint) await sub.unsubscribe();
    } catch {
      // The row is gone; the browser may keep a subscription nobody sends to.
    }
  }
  return r;
}
