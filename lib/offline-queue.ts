// lib/offline-queue.ts
// Check-ins and undos made without a connection, kept in order until they reach the server.
// The server decides whether each one counts (ideas/offline.md); this module only stores and sends.

// byChild: a tap in the kid view (logged as by the child, "Mary did it").
export type QueuedCheckIn = { kind: "check_in"; clientId: string; habitId: string; subjectId: string | null; tappedAt: string; byChild?: boolean };
export type QueuedUndo = { kind: "undo"; clientId: string; habitId: string };
export type QueueEntry = QueuedCheckIn | QueuedUndo;

export type SendOutcome = "synced" | "rejected" | "retry";
export type Sender = (entry: QueueEntry) => Promise<SendOutcome>;
// dropped: a check-in whose undo already reached the server in this run; it is never sent again.
export type FlushResult = { remaining: QueueEntry[]; synced: QueueEntry[]; rejected: QueueEntry[]; dropped: QueueEntry[] };

const same = (a: QueueEntry, b: QueueEntry) => a.kind === b.kind && a.clientId === b.clientId;

export function addCheckIn(queue: QueueEntry[], entry: QueuedCheckIn): QueueEntry[] {
  return queue.some((e) => same(e, entry)) ? queue : [...queue, entry];
}

export function addUndo(queue: QueueEntry[], undo: QueuedUndo, inFlight: ReadonlySet<string> = new Set()): QueueEntry[] {
  const unsent = !inFlight.has(undo.clientId) && queue.some((e) => e.kind === "check_in" && e.clientId === undo.clientId);
  if (unsent) return queue.filter((e) => !(e.kind === "check_in" && e.clientId === undo.clientId));
  return queue.some((e) => same(e, undo)) ? queue : [...queue, undo];
}

export function pendingHabitIds(queue: QueueEntry[]): Set<string> {
  return new Set(queue.map((e) => e.habitId));
}

// Whose check-in on which habit: a group habit can be mine and a child's at once.
export const queueKey = (habitId: string, subjectId: string | null = null) => (subjectId ? `${habitId}/${subjectId}` : habitId);

// How many check-ins wait per habit and person (queueKey); a habit done 3 times a day can have two.
export function pendingCounts(queue: QueueEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of queue) {
    if (e.kind !== "check_in") continue;
    const k = queueKey(e.habitId, e.subjectId);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

// The clientIds whose undo the server has answered (done, or refused with a feed note): a check-in
// with that id must not be sent after it, or it would come back (the server keeps no tombstone).
export function undoneIds(entries: QueueEntry[]): Set<string> {
  return new Set(entries.filter((e) => e.kind === "undo").map((e) => e.clientId));
}

export async function flush(queue: QueueEntry[], send: Sender): Promise<FlushResult> {
  const synced: QueueEntry[] = [];
  const rejected: QueueEntry[] = [];
  const dropped: QueueEntry[] = [];
  const undone = new Set<string>();
  for (let i = 0; i < queue.length; i++) {
    const entry = queue[i];
    if (entry.kind === "check_in" && undone.has(entry.clientId)) {
      dropped.push(entry);
      continue;
    }
    let outcome: SendOutcome;
    try {
      outcome = await send(entry);
    } catch {
      outcome = "retry";
    }
    if (outcome === "retry") return { remaining: queue.slice(i), synced, rejected, dropped };
    (outcome === "synced" ? synced : rejected).push(entry);
    if (entry.kind === "undo") undone.add(entry.clientId);
  }
  return { remaining: [], synced, rejected, dropped };
}
