// lib/offline-queue.ts
// Check-ins and undos made without a connection, kept in order until they reach the server.
// The server decides whether each one counts (ideas/offline.md); this module only stores and sends.

// byChild: a tap in the kid view (logged as by the child, "Mary did it"). attempts / firstFailedAt:
// counted failures and when the first was (see GIVE_UP_AFTER); kept on the phone, never sent.
type Failures = { attempts?: number; firstFailedAt?: string };
export type QueuedCheckIn = {
  kind: "check_in"; clientId: string; habitId: string; subjectId: string | null; tappedAt: string; byChild?: boolean;
} & Failures;
export type QueuedUndo = { kind: "undo"; clientId: string; habitId: string } & Failures;
export type QueueEntry = QueuedCheckIn | QueuedUndo;

// synced: the server has it. rejected: a rule refused it (final; the server's feed note explains).
// retry: something answered but couldn't take it (a 5xx, a captive portal's page): counted.
// wait: try later, not counted (a timeout, an expired session: the next signed-in flush sends it).
// A thrown error (no network at all) is a wait too.
export type SendOutcome = "synced" | "rejected" | "retry" | "wait";
export type Sender = (entry: QueueEntry) => Promise<SendOutcome>;
// An entry is given up (poisoned) only after MAX_ATTEMPTS counted failures AND a day since the first,
// so an outage never costs a tap, and one entry the server can never take can't block the queue forever.
export const MAX_ATTEMPTS = 5;
export const GIVE_UP_AFTER_MS = 24 * 60 * 60 * 1000;
// dropped: a check-in whose undo already reached the server in this run; it is never sent again.
// poisoned: given up after MAX_ATTEMPTS. attempted: the entry the flush stopped at, with its new count.
export type FlushResult = {
  remaining: QueueEntry[]; synced: QueueEntry[]; rejected: QueueEntry[]; dropped: QueueEntry[]; poisoned: QueueEntry[];
  attempted: QueueEntry | null;
};

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

export async function flush(queue: QueueEntry[], send: Sender, now: () => Date = () => new Date()): Promise<FlushResult> {
  const synced: QueueEntry[] = [];
  const rejected: QueueEntry[] = [];
  const dropped: QueueEntry[] = [];
  const poisoned: QueueEntry[] = [];
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
      outcome = "wait"; // no network
    }
    // Keep this entry and everything after it, uncounted.
    if (outcome === "wait") return { remaining: queue.slice(i), synced, rejected, dropped, poisoned, attempted: null };
    if (outcome === "retry") {
      const at = now();
      const attempts = (entry.attempts ?? 0) + 1;
      const firstFailedAt = entry.firstFailedAt ?? at.toISOString();
      if (attempts >= MAX_ATTEMPTS && at.getTime() - Date.parse(firstFailedAt) > GIVE_UP_AFTER_MS) {
        poisoned.push(entry);
        continue;
      }
      const attempted = { ...entry, attempts, firstFailedAt };
      return { remaining: [attempted, ...queue.slice(i + 1)], synced, rejected, dropped, poisoned, attempted };
    }
    (outcome === "synced" ? synced : rejected).push(entry);
    if (entry.kind === "undo") undone.add(entry.clientId);
  }
  return { remaining: [], synced, rejected, dropped, poisoned, attempted: null };
}
