// lib/push-subscription-request.ts
import { isSameOrigin } from "@/lib/review-request";
import type { SubscriptionKeys } from "@/lib/push-support";

export type PushSubscriptionRequest = { ok: true; sub: SubscriptionKeys } | { ok: false; status: 400 | 403 };

// The service worker posts a renewed subscription here (pushsubscriptionchange: same origin, session
// cookie). The database checks the endpoint and keys; this only refuses other sites and odd bodies.
export function parsePushSubscriptionRequest(input: { origin: string | null; host: string | null; body: unknown }): PushSubscriptionRequest {
  if (!isSameOrigin(input.origin, input.host)) return { ok: false, status: 403 };
  const b = (input.body ?? {}) as Record<string, unknown>;
  const { endpoint, p256dh, auth } = b;
  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string" || !endpoint || !p256dh || !auth) {
    return { ok: false, status: 400 };
  }
  return { ok: true, sub: { endpoint, p256dh, auth } };
}
