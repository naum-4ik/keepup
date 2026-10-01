// lib/review-request.ts
import { isUuid } from "@/lib/habit-schema";

export type ReviewRequest = { ok: true; checkInId: string; approve: boolean } | { ok: false; status: 400 | 403 };

// The notification buttons post here from the service worker (same origin, session cookie). A
// browser sends Origin on POST; a different one is another site trying to review for you.
export function parseReviewRequest(input: { id: string; origin: string | null; host: string | null; body: unknown }): ReviewRequest {
  if (input.origin !== null) {
    let host: string | null = null;
    try {
      host = new URL(input.origin).host;
    } catch {
      host = null;
    }
    if (!host || host !== input.host) return { ok: false, status: 403 };
  }
  if (!isUuid(input.id)) return { ok: false, status: 400 };
  const approve = (input.body as { approve?: unknown } | null)?.approve;
  if (typeof approve !== "boolean") return { ok: false, status: 400 };
  return { ok: true, checkInId: input.id, approve };
}
