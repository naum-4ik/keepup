// lib/push-subscription-request.ts
import { isSameOrigin } from "@/lib/review-request";
import type { SubscriptionKeys } from "@/lib/push-support";

// Two callers, one rule: only a device this account still has is saved.
// - `refresh`: the app, on open, saves this device again so the 10-device cap never drops it.
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

// A device removed under Devices (or never saved) stays removed: 204, nothing saved. A rotation saves
// the new subscription and drops the old row.
export async function applyPushSubscriptionUpdate(
  update: PushSubscriptionUpdate,
  deps: {
    owns(endpoint: string): Promise<boolean>;
    save(sub: SubscriptionKeys): Promise<{ ok: true } | { ok: false; code?: string }>;
    forget(endpoint: string): Promise<void>;
  },
): Promise<{ status: 200 | 204 } | { status: 409; code?: string }> {
  const known = update.refresh ? update.sub.endpoint : update.oldEndpoint;
  if (!known || !(await deps.owns(known))) return { status: 204 };
  const saved = await deps.save(update.sub);
  if (!saved.ok) return { status: 409, code: saved.code };
  if (!update.refresh && update.oldEndpoint !== update.sub.endpoint) await deps.forget(known);
  return { status: 200 };
}
