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

export function urlBase64ToUint8Array(base64: string): Uint8Array {
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
