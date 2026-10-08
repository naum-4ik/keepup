// lib/push-subscription-request.ts
import { isSameOrigin } from "@/lib/review-request";
import type { SubscriptionKeys } from "@/lib/push-support";

// Two callers, one rule: a device removed under Devices (or never saved) stays removed.
// - `refresh`: the app, on open, saves this device again so the 10-device cap never drops it, and so a
//   phone shared without signing out follows whoever is signed in now (same browser, same keys).
// - otherwise: the service worker's pushsubscriptionchange, carrying the subscription it replaced.
export type PushSubscriptionUpdate = { sub: SubscriptionKeys; oldEndpoint: string | null; refresh: boolean };
export type PushSubscriptionRequest = ({ ok: true } & PushSubscriptionUpdate) | { ok: false; status: 400 | 403 };

// Same origin, session cookie. The database checks the endpoint and keys; this only refuses other
// sites and odd bodies.
export function parsePushSubscriptionRequest(input: { origin: string | null; host: string | null; body: unknown }): PushSubscriptionRequest {
  if (!isSameOrigin(input.origin, input.host)) return { ok: false, status: 403 };
  const b = (input.body ?? {}) as Record<string, unknown>;
  const { endpoint, p256dh, auth, oldEndpoint, refresh } = b;
  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string" || !endpoint || !p256dh || !auth) {
    return { ok: false, status: 400 };
  }
  if (oldEndpoint !== undefined && oldEndpoint !== null && typeof oldEndpoint !== "string") return { ok: false, status: 400 };
  return { ok: true, sub: { endpoint, p256dh, auth }, oldEndpoint: oldEndpoint || null, refresh: refresh === true };
}

// Each is one database call (one transaction). A removed device: 204, nothing saved. A rotation of a
// device this account has saves the new subscription and drops the old row; refused, the old row stays.
export type SaveOutcome = { ok: true; saved: boolean } | { ok: false; code?: string };

export async function applyPushSubscriptionUpdate(
  update: PushSubscriptionUpdate,
  deps: {
    refresh(sub: SubscriptionKeys): Promise<SaveOutcome>;
    rotate(oldEndpoint: string, sub: SubscriptionKeys): Promise<SaveOutcome>;
  },
): Promise<{ status: 200 | 204 } | { status: 409; code?: string }> {
  if (!update.refresh && !update.oldEndpoint) return { status: 204 };
  const r = update.refresh ? await deps.refresh(update.sub) : await deps.rotate(update.oldEndpoint!, update.sub);
  if (!r.ok) return { status: 409, code: r.code };
  return { status: r.saved ? 200 : 204 };
}
