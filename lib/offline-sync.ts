// lib/offline-sync.ts
// The page's side of the offline queue: what the sync route accepts, and what its answers mean.
import { isUuid } from "@/lib/habit-schema";
import { queueKey, type QueueEntry, type Sender, type SendOutcome } from "@/lib/offline-queue";

export function parseEntry(body: unknown): QueueEntry | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.clientId !== "string" || !isUuid(b.clientId) || typeof b.habitId !== "string" || !isUuid(b.habitId)) return null;
  if (b.kind === "undo") return { kind: "undo", clientId: b.clientId, habitId: b.habitId };
  if (b.kind !== "check_in") return null;
  if (b.subjectId !== null && (typeof b.subjectId !== "string" || !isUuid(b.subjectId))) return null;
  if (typeof b.tappedAt !== "string" || Number.isNaN(Date.parse(b.tappedAt))) return null;
  return {
    kind: "check_in",
    clientId: b.clientId,
    habitId: b.habitId,
    subjectId: b.subjectId as string | null,
    tappedAt: new Date(b.tappedAt).toISOString(),
    ...(b.byChild === true ? { byChild: true } : {}),
  };
}

// A rule refusal is final (the server's feed note explains it). Only a real answer from the sync route
// counts: a 200 without its JSON (a captive portal's login page) is a retry, like a server problem or
// an expired session. 403/405 can never succeed from this page, so they're dropped rather than retried.
export function outcomeFor(status: number, body: unknown): SendOutcome {
  const outcome = (body as { outcome?: unknown } | null)?.outcome;
  if (status === 200) return outcome === "synced" ? "synced" : outcome === "rejected" ? "rejected" : "retry";
  if (status === 400 || status === 403 || status === 405 || status === 409) return "rejected";
  return "retry";
}

// A request that hangs is given up after this long and tried again later (it counts as a retry).
export const SEND_TIMEOUT_MS = 10_000;

export function httpSender(fetchImpl: typeof fetch = (input, init) => fetch(input, init), timeoutMs = SEND_TIMEOUT_MS): Sender {
  return async (entry) => {
    // The phone's own bookkeeping (attempts) stays here.
    const body = { ...entry };
    delete body.attempts;
    let res: Response;
    try {
      res = await fetchImpl("/api/check-ins/sync", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      // Timed out: the server may be stuck; counts. Anything else is no network: thrown, not counted.
      if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")) return "retry";
      throw e;
    }
    return outcomeFor(res.status, await res.json().catch(() => null));
  };
}

// Queued taps (counts by queueKey) show as check-ins until the server has them, never past the
// target. subjectId: whose habits these are (a child's in the kid view; null for mine).
export function withQueuedTaps<T extends { id: string; done: number; target: number; state: string }>(
  habits: T[],
  queued: ReadonlyMap<string, number>,
  subjectId: string | null = null,
): { habits: T[]; added: number } {
  let added = 0;
  const shown = habits.map((h) => {
    const extra = Math.min(queued.get(queueKey(h.id, subjectId)) ?? 0, Math.max(0, h.target - h.done));
    if (extra === 0) return h;
    added += extra;
    const done = h.done + extra;
    return { ...h, done, state: done >= h.target ? "done" : h.state } as T;
  });
  return { habits: shown, added };
}

// Every tap carries an id made on the phone (ideas/offline.md §4), so a resend of the same tap never
// counts twice. Only a tap that waited in the queue sends the phone's time; an online tap sends none and
// the server uses its own clock (addendum 6, amended), so a phone clock that's off can't move it.
export type TapId = { clientId: string; tappedAt?: string };

export function newTap(now = new Date()): Required<TapId> {
  return { clientId: crypto.randomUUID(), tappedAt: now.toISOString() };
}

export function isTap(tap: unknown): tap is TapId | undefined {
  if (tap === undefined) return true;
  if (!tap || typeof tap !== "object") return false;
  const t = tap as Record<string, unknown>;
  if (typeof t.clientId !== "string" || !isUuid(t.clientId)) return false;
  return t.tappedAt === undefined || (typeof t.tappedAt === "string" && !Number.isNaN(Date.parse(t.tappedAt)));
}

export function tapArgs(tap: TapId | undefined): { p_client_id?: string; p_tapped_at?: string } {
  if (!tap) return {};
  return tap.tappedAt ? { p_client_id: tap.clientId, p_tapped_at: new Date(tap.tappedAt).toISOString() } : { p_client_id: tap.clientId };
}
