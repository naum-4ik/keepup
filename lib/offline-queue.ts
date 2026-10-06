// lib/offline-queue.ts
// Check-ins and undos made without a connection, kept in order until they reach the server.
// The server decides whether each one counts (ideas/offline.md); this module only stores and sends.
import { todayIn } from "./dates";

// byChild: a tap in the kid view (logged as by the child, "Mary did it"). attempts / firstFailedAt:
// counted failures and when the first was (see GIVE_UP_AFTER); kept on the phone, never sent.
// maybeSent: it was tried online or sent by a flush, so the server may have it although no answer
// came back; an Undo then has to ask the server (addUndo). Kept on the phone, never sent.
type Failures = { attempts?: number; firstFailedAt?: string };
export type QueuedCheckIn = {
  kind: "check_in"; clientId: string; habitId: string; subjectId: string | null; tappedAt: string; byChild?: boolean; maybeSent?: boolean;
} & Failures;
// subjectId: whose tap it takes back (its tap's; older stored undos have none: mine). queuedAt: when
// it was made (older stored undos have none). Both kept on the phone, never sent.
export type QueuedUndo = { kind: "undo"; clientId: string; habitId: string; subjectId?: string | null; queuedAt?: string } & Failures;
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

// An Undo. A check-in never tried (not maybe sent, not in a flush running now) is simply removed:
// nothing reaches the server. One the server may have (maybeSent, or in flight) leaves the queue too,
// so it shows open at once, and an undo is queued: the server removes it by its client id if it
// arrived (and does nothing if it didn't). An undo of a check-in no longer here (it synced) is queued.
export function addUndo(queue: QueueEntry[], undo: QueuedUndo, inFlight: ReadonlySet<string> = new Set()): QueueEntry[] {
  const isTap = (e: QueueEntry) => e.kind === "check_in" && e.clientId === undo.clientId;
  const tap = queue.find(isTap) as QueuedCheckIn | undefined;
  const rest = queue.filter((e) => !isTap(e));
  if (tap && !tap.maybeSent && !inFlight.has(undo.clientId)) return rest;
  const entry: QueuedUndo = tap ? { ...undo, subjectId: tap.subjectId } : undo;
  return rest.some((e) => same(e, entry)) ? rest : [...rest, entry];
}

export function pendingHabitIds(queue: QueueEntry[]): Set<string> {
  return new Set(queue.map((e) => e.habitId));
}

// Whose check-in on which habit: a group habit can be mine and a child's at once.
export const queueKey = (habitId: string, subjectId: string | null = null) => (subjectId ? `${habitId}/${subjectId}` : habitId);

// How many check-ins wait per habit and person (queueKey); a habit done 3 times a day can have two.
// `queue`: the entries these counts were taken from (the same snapshot), for queuedDelta; not
// enumerable, so the counts still compare as a plain Map.
export type PendingCounts = Map<string, number> & { readonly queue?: readonly QueueEntry[] };
export function pendingCounts(queue: QueueEntry[]): PendingCounts {
  const counts = new Map<string, number>();
  for (const e of queue) {
    if (e.kind !== "check_in") continue;
    const k = queueKey(e.habitId, e.subjectId);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Object.defineProperty(counts, "queue", { value: queue, enumerable: false });
}

// A live refresh normally waits while anything is queued (it would draw the server's answer over a
// waiting tap). A queue that is stuck may not hold the page back for ever: once its oldest entry is
// over STUCK_AFTER_MS old, every waiting check-in may already be on the server (maybeSent: tried
// online or by a flush), and nothing is being sent right now (`running`), the refresh goes ahead; the
// rendered-ids rule (queuedDelta) keeps it from counting a tap twice. A never-tried tap keeps holding:
// the server can't have it, so a refresh could only draw it as not done. An undo from before
// queuedAt existed counts as old.
export const STUCK_AFTER_MS = 2 * 60 * 1000;
export function holdsRefresh(queue: readonly QueueEntry[], now: Date, running: boolean): boolean {
  if (queue.length === 0) return false;
  if (running || queue.some((e) => e.kind === "check_in" && !e.maybeSent)) return true;
  const times = queue.map((e) => (e.kind === "check_in" ? Date.parse(e.tappedAt) : e.queuedAt ? Date.parse(e.queuedAt) : -Infinity));
  return now.getTime() - Math.min(...times) <= STUCK_AFTER_MS;
}

// The period each habit's counts are drawn for (lib/rendered-taps.ts tapPeriods): its first local
// day, and the time zone the habit's calendar runs on (a group's, or the person's).
export type ShownPeriods = ReadonlyMap<string, { start: string; timeZone: string }>;

// A waiting tap counts toward the period the page shows only if it was tapped in it or later: one
// from before (a late tap from yesterday, still on the phone) lands in its own period when it is
// sent, not in this one. A habit the page gives no period for counts every tap, as before; so does a
// tap after the shown period (a saved page from yesterday, opened offline today).
export function inShownPeriod(e: QueuedCheckIn, periods: ShownPeriods | null | undefined): boolean {
  const p = periods?.get(e.habitId);
  if (!p) return true;
  try {
    return todayIn(p.timeZone, new Date(e.tappedAt)) >= p.start;
  } catch {
    return true; // an unknown time zone or a broken time: count it, as before
  }
}

// What the waiting entries change on screen, per queueKey, against the check-ins the page was
// rendered with (`rendered`: their client ids). A tap adds one, unless the page already counts it
// (it reached the server before the page was drawn) or it belongs to an earlier period than the one
// shown (`periods`, inShownPeriod). An undo takes one back only when the page counts its tap; an undo
// of a tap the page never had changes nothing. Without a rendered list (a page saved before the list
// existed), only taps count, as before.
export function queuedDelta(
  queue: readonly QueueEntry[],
  rendered: ReadonlySet<string> | null,
  periods: ShownPeriods | null = null,
): Map<string, number> {
  const delta = new Map<string, number>();
  const add = (k: string, n: number) => {
    const v = (delta.get(k) ?? 0) + n;
    if (v === 0) delta.delete(k);
    else delta.set(k, v);
  };
  for (const e of queue) {
    if (e.kind === "check_in") {
      if (!rendered?.has(e.clientId) && inShownPeriod(e, periods)) add(queueKey(e.habitId, e.subjectId), 1);
    } else if (rendered?.has(e.clientId)) {
      add(queueKey(e.habitId, e.subjectId ?? null), -1);
    }
  }
  return delta;
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
