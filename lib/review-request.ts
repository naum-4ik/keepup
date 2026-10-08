// lib/review-request.ts
import { isUuid } from "@/lib/habit-schema";

// A browser sends Origin on POST; a different one is another site acting with your cookie. No Origin
// (an older browser, or a same-origin fetch that leaves it out) is allowed.
export function isSameOrigin(origin: string | null, host: string | null): boolean {
  if (origin === null) return true;
  try {
    const h = new URL(origin).host;
    return h !== "" && h === host;
  } catch {
    return false;
  }
}

export type ReviewRequest = { ok: true; checkInId: string; approve: boolean } | { ok: false; status: 400 | 403 };

// The notification buttons post here from the service worker (same origin, session cookie).
export function parseReviewRequest(input: { id: string; origin: string | null; host: string | null; body: unknown }): ReviewRequest {
  if (!isSameOrigin(input.origin, input.host)) return { ok: false, status: 403 };
  if (!isUuid(input.id)) return { ok: false, status: 400 };
  const approve = (input.body as { approve?: unknown } | null)?.approve;
  if (typeof approve !== "boolean") return { ok: false, status: 400 };
  return { ok: true, checkInId: input.id, approve };
}
