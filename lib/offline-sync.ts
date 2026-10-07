// lib/offline-sync.ts
// The page's side of the offline queue: what the sync route accepts, and what its answers mean.
import { GENERIC_ERROR } from "@/lib/habit-errors";
import { isUuid } from "@/lib/habit-schema";
import { queueKey, type QueueEntry, type Sender, type SendOutcome } from "@/lib/offline-queue";
import type { TapXp } from "@/lib/xp";

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
// counts: a 200 without its JSON (a captive portal's login page) is a counted retry, like a server
// problem. An expired session (401) just waits: the next signed-in flush sends it. 403/405/413 can
// never succeed from this page, so they're dropped rather than retried.
export function outcomeFor(status: number, body: unknown): SendOutcome {
  const outcome = (body as { outcome?: unknown } | null)?.outcome;
  if (status === 200) return outcome === "synced" ? "synced" : outcome === "rejected" ? "rejected" : "retry";
  if (status === 400 || status === 403 || status === 405 || status === 409 || status === 413) return "rejected";
  if (status === 401) return "wait";
  return "retry";
}

// A request that hangs is given up after this long and tried again later (not counted: a slow
// network isn't the entry's fault).
export const SEND_TIMEOUT_MS = 10_000;

export function httpSender(fetchImpl: typeof fetch = (input, init) => fetch(input, init), timeoutMs = SEND_TIMEOUT_MS): Sender {
  return async (entry) => {
    // The phone's own bookkeeping stays here.
    const body = { ...entry };
    delete body.attempts;
    delete body.firstFailedAt;
    delete body.tryingUntil;
    if (body.kind === "check_in") delete body.maybeSent;
    else {
      delete body.subjectId;
      delete body.queuedAt;
    }
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
      // Timed out: try later. Anything else is no network: thrown (also not counted).
      if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")) return "wait";
      throw e;
    }
    return outcomeFor(res.status, await res.json().catch(() => null));
  };
}

// Queued taps (lib/offline-queue.ts queuedDelta, by queueKey) show as check-ins until the page has
// them, never past the target; a queued undo of a tap the page counts takes it back, never below 0.
// subjectId: whose habits these are (a child's in the kid view; null for mine).
export function withQueuedTaps<T extends { id: string; done: number; target: number; state: string }>(
  habits: T[],
  queued: ReadonlyMap<string, number>,
  subjectId: string | null = null,
): { habits: T[]; added: number } {
  let added = 0;
  const shown = habits.map((h) => {
    const q = queued.get(queueKey(h.id, subjectId)) ?? 0;
    const extra = q > 0 ? Math.min(q, Math.max(0, h.target - h.done)) : Math.max(q, -h.done);
    if (extra === 0) return h;
    added += extra;
    const done = h.done + extra;
    return { ...h, done, state: done >= h.target ? "done" : h.state === "done" ? "open" : h.state } as T;
  });
  return { habits: shown, added };
}

// Every tap carries an id made on the phone (ideas/offline.md §4), so a resend of the same tap never
// counts twice. Only a tap that waited in the queue sends the phone's time; an online tap
// (app/api/check-ins/tap) sends none and the server uses its own clock (addendum 6, amended), so a
// phone clock that's off can't move it.
export function newTap(now = new Date()): { clientId: string; tappedAt: string } {
  return { clientId: crypto.randomUUID(), tappedAt: now.toISOString() };
}

// A tap tried online (app/api/check-ins/tap): mine, or for a child (subjectId; byChild: in the kid view).
export type OnlineTap = { clientId: string; habitId: string; subjectId: string | null; byChild?: boolean };
export type OnlineAnswer = { ok: true; xp?: TapXp } | { ok: false; message: string; code?: string };

export function parseTap(body: unknown): OnlineTap | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.clientId !== "string" || !isUuid(b.clientId) || typeof b.habitId !== "string" || !isUuid(b.habitId)) return null;
  if (b.subjectId !== null && b.subjectId !== undefined && (typeof b.subjectId !== "string" || !isUuid(b.subjectId))) return null;
  return {
    clientId: b.clientId,
    habitId: b.habitId,
    subjectId: (b.subjectId as string | null | undefined) ?? null,
    ...(b.byChild === true ? { byChild: true } : {}),
  };
}

// The tap route's answer, as submitTap reads it. A refusal carries its rule's code (final); an expired
// session carries not_authenticated (kept queued: the next signed-in flush sends it); anything else,
// a 200 without its JSON (a captive portal) included, has no code and keeps the tap queued.
export function tapAnswer(status: number, body: unknown): OnlineAnswer {
  const b = (body ?? {}) as { xp?: unknown; code?: unknown; message?: unknown };
  if (status === 200 && body && typeof body === "object" && "xp" in b) {
    return { ok: true, xp: typeof b.xp === "number" || b.xp === null ? b.xp : 0 };
  }
  const message = typeof b.message === "string" ? b.message : GENERIC_ERROR;
  if ((status === 409 || status === 401) && typeof b.code === "string") return { ok: false, message, code: b.code };
  return { ok: false, message };
}

// Sends one online tap; `signal` aborts it (submitTap's timeout), so a late answer never arrives.
// No network, or aborted: thrown (submitTap keeps the tap queued).
export function tapSender(fetchImpl: typeof fetch = (input, init) => fetch(input, init)) {
  return async (tap: OnlineTap, signal?: AbortSignal): Promise<OnlineAnswer> => {
    const res = await fetchImpl("/api/check-ins/tap", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tap),
      signal,
    });
    return tapAnswer(res.status, await res.json().catch(() => null));
  };
}
