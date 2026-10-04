// lib/offline-sync.ts
// The page's side of the offline queue: what the sync route accepts, and what its answers mean.
import { isUuid } from "@/lib/habit-schema";
import type { QueueEntry, Sender, SendOutcome } from "@/lib/offline-queue";

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

// A rule refusal is final (the server's feed note explains it); only an expired session or a server
// or network problem is tried again. A retry stops the queue there, so nothing that can never succeed
// may be a retry: tap_in_future (a phone clock far ahead) is dropped too.
export function outcomeFor(status: number, body: unknown): SendOutcome {
  if (status === 200) return (body as { outcome?: unknown } | null)?.outcome === "rejected" ? "rejected" : "synced";
  if (status === 400 || status === 409) return "rejected";
  return "retry";
}

export function httpSender(fetchImpl: typeof fetch = (input, init) => fetch(input, init)): Sender {
  return async (entry) => {
    const res = await fetchImpl("/api/check-ins/sync", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    return outcomeFor(res.status, await res.json().catch(() => null));
  };
}

// Queued taps show as check-ins until the server has them, never past the target.
export function withQueuedTaps<T extends { id: string; done: number; target: number; state: string }>(
  habits: T[],
  queued: ReadonlyMap<string, number>,
): { habits: T[]; added: number } {
  let added = 0;
  const shown = habits.map((h) => {
    const extra = Math.min(queued.get(h.id) ?? 0, Math.max(0, h.target - h.done));
    if (extra === 0) return h;
    added += extra;
    const done = h.done + extra;
    return { ...h, done, state: done >= h.target ? "done" : h.state } as T;
  });
  return { habits: shown, added };
}
