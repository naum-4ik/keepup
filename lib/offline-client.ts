// lib/offline-client.ts
// The page's offline queue runner (used by components/offline/offline-queue-provider.tsx): when to
// send, how a tap is saved before it is tried online, and how the UI hears about it. Browser-agnostic
// (everything comes in as deps), so it is unit-tested in Node.
import { holdsRefresh, pendingCounts, queueKey, type FlushResult, type QueueEntry, type Sender } from "@/lib/offline-queue";
import { createOfflineQueue, type Locks, type QueueStorage } from "@/lib/offline-queue-store";
import { newTap } from "@/lib/offline-sync";
import type { TapXp } from "@/lib/xp";

// Waiting check-ins per queueKey; `queue`: the entries they were counted from (lib/offline-queue.ts
// pendingCounts), so the page can tell what they change on screen (queuedDelta).
export type Counts = ReadonlyMap<string, number> & { readonly queue?: readonly QueueEntry[] };
export type Flushed = { counts: Counts; changed: boolean; poisoned: number };
export type TapResult = { ok: true; queued: boolean; xp?: TapXp } | { ok: false; message: string };
// The online try (lib/offline-sync.ts tapSender): `signal` aborts it when it takes too long.
type Online = (tap: { clientId: string }, signal: AbortSignal) => Promise<{ ok: true; xp?: TapXp } | { ok: false; message: string; code?: string }>;

// A database rule refused it: final, the same answers the sync route maps to 409. An expired session
// isn't one (the next signed-in flush sends it).
export const isRuleRefusal = (code: string | undefined) => Boolean(code) && code !== "not_authenticated";
// Another tab of this app (BroadcastChannel), told when this one changed the queue.
export type Channel = { post(): void; listen(onMessage: () => void): () => void };

// An online tap that takes longer than this is left to the queue (it may still land: client_id).
export const TAP_TIMEOUT_MS = 10_000;
// While entries wait and the phone says it's online: try again after 3 s, 9 s, 30 s, then every 5 min.
export const RETRY_DELAYS_MS = [3_000, 9_000, 30_000, 300_000] as const;

export function createOfflineClient(deps: {
  storage: QueueStorage;
  send: Sender;
  locks?: Locks | null;
  isOnline: () => boolean;
  // A tap saved or forgotten: show it now. landed: an online tap reached the server and left the
  // queue; show that together with a page refresh (it's on the server now, not on the phone).
  onCounts: (counts: Counts, landed: boolean) => void;
  // A flush finished (or another tab's did): apply the counts together with a page refresh.
  onFlushed: (flushed: Flushed) => void;
  channel?: Channel | null;
  now?: () => Date;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (t: unknown) => void;
  tapTimeoutMs?: number;
}) {
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((t) => clearTimeout(t as ReturnType<typeof setTimeout>));
  let flushing = false;
  let held: Counts | null = null;
  // An online tap is leaving the queue because it landed (onCounts' landed), and whether that
  // happened while a flush held the counts back (the flush then refreshes).
  let landing = false;
  let heldLanded = false;
  let last: Counts = new Map();
  // Entries waiting, as of the latest change (also while a flush holds its counts back), and online
  // tries running now: what holdsRefresh needs.
  let waiting: readonly QueueEntry[] = [];
  let trying = 0;
  const saw = (counts: Counts) => void (waiting = counts.queue ?? []);
  let timer: unknown = null;
  let step = 0;

  const emit = (counts: Counts, landed = false) => {
    saw(counts);
    last = counts;
    deps.onCounts(counts, landed);
  };
  // Taps whose online try is still running. The server may not have them yet, so an undo for one
  // waits: sent now, it would find nothing (and be done with), and the check-in would land after it.
  const tryingIds = new Set<string>();
  const queue = createOfflineQueue({
    storage: deps.storage,
    send: (e) => (e.kind === "undo" && tryingIds.has(e.clientId) ? Promise.resolve("wait") : deps.send(e)),
    locks: deps.locks ?? null,
    now: deps.now,
    onChange: (counts) => {
      saw(counts);
      if (flushing) {
        held = counts;
        heldLanded ||= landing;
      } else emit(counts, landing);
    },
  });

  function scheduleFlush() {
    if (timer !== null) return;
    timer = setTimer(() => {
      timer = null;
      void flush();
    }, RETRY_DELAYS_MS[step]);
    step = Math.min(step + 1, RETRY_DELAYS_MS.length - 1);
  }

  async function flush(): Promise<FlushResult | null> {
    if (!deps.isOnline()) return null;
    flushing = true;
    held = null;
    heldLanded = false;
    let r: FlushResult;
    try {
      r = await queue.flush();
    } finally {
      flushing = false;
    }
    const counts = held ?? pendingCounts(await deps.storage.load());
    saw(counts);
    const changed = r.synced.length + r.rejected.length + r.dropped.length + r.poisoned.length > 0;
    last = counts;
    deps.onFlushed({ counts, changed: changed || heldLanded, poisoned: r.poisoned.length });
    if (changed) deps.channel?.post();
    // Still waiting while the phone says it's online (a server problem, or a network that lies): try
    // again later, backing off. Offline, the `online` event brings the next flush. An entry added
    // while this flush ran (an Undo of the tap it was sending) wasn't in its snapshot: it is sent by
    // the next flush, soon, rather than waiting for the app to come back into view.
    const left = counts.queue?.length ?? r.remaining.length;
    if (r.remaining.length === 0) step = 0;
    if (left > 0 && deps.isOnline()) scheduleFlush();
    return r;
  }

  // Another tab sent (or added) some: if anything this tab shows as waiting is gone, refresh.
  const onOtherTab = () => {
    void (async () => {
      const counts = pendingCounts(await deps.storage.load());
      const dropped = [...last].some(([k, n]) => (counts.get(k) ?? 0) < n);
      saw(counts);
      last = counts;
      deps.onFlushed({ counts, changed: dropped, poisoned: 0 });
    })();
  };
  let stopListening: (() => void) | undefined;

  // A tap is saved on the phone first, so closing the app mid-request never loses it. Offline it
  // just waits. Online it is tried at once with its id only (the server's clock decides the day); it
  // leaves the queue when it landed or a database rule refused it (a keepup: code). Anything else (no
  // answer, slower than TAP_TIMEOUT_MS, an error without a rule): it stays queued with the phone's tap
  // time and a flush is scheduled; if the first
  // try did land, the server returns that row for the resend (client_id), so it never counts twice.
  async function submitTap(t: { habitId: string; subjectId?: string | null; byChild?: boolean }, online: Online): Promise<TapResult> {
    const tap = newTap(deps.now?.());
    await queue.checkIn(t.habitId, t.subjectId ?? null, { clientId: tap.clientId, byChild: t.byChild, tappedAt: tap.tappedAt });
    if (!deps.isOnline()) return { ok: true, queued: true };
    await queue.markMaybeSent(tap.clientId);
    let result: Awaited<ReturnType<Online>>;
    // Too slow: the request is aborted, so its answer never arrives to redraw anything. The tap stays
    // queued (it may still have landed: its client id makes the resend count once).
    const abort = new AbortController();
    trying++;
    tryingIds.add(tap.clientId);
    try {
      result = await withTimeout(online({ clientId: tap.clientId }, abort.signal), deps.tapTimeoutMs ?? TAP_TIMEOUT_MS, setTimer, clearTimer, () => abort.abort());
    } catch {
      scheduleFlush();
      return { ok: true, queued: true };
    } finally {
      trying--;
      tryingIds.delete(tap.clientId);
      void sendWaitingUndo(tap.clientId);
    }
    // Answered, but this tap no longer waits here: another tab took it back (Undo) or sent it. That
    // answer is about a tap the screen no longer shows as this one; whoever changed it refreshes.
    if (!(await deps.storage.load()).some((e) => e.kind === "check_in" && e.clientId === tap.clientId)) {
      return result.ok ? { ok: true, queued: false } : { ok: false, message: result.message };
    }
    if (result.ok) {
      landing = true;
      try {
        await queue.forget(tap.clientId);
      } finally {
        landing = false;
      }
      // The XP float shows only for a check-in that counted now (lib/xp.ts); null: counted, amount unknown.
      return result.xp === 0 || result.xp === undefined ? { ok: true, queued: false } : { ok: true, queued: false, xp: result.xp };
    }
    if (isRuleRefusal(result.code)) {
      await queue.forget(tap.clientId);
      return { ok: false, message: result.message };
    }
    // An error without a rule (the database had a problem, the session expired): it stays queued.
    scheduleFlush();
    return { ok: true, queued: true };
  }

  // Undo next to "Saving…": the latest tap on this habit still waiting here is taken back. Never
  // tried, it is simply removed (nothing reaches the server); one the server may have (tried online,
  // or sent by a flush) is replaced by an undo the server applies by its client id (addUndo). Either
  // way it shows open at once. False when nothing is waiting.
  async function undoQueued(habitId: string, subjectId: string | null = null): Promise<boolean> {
    const key = queueKey(habitId, subjectId);
    const last = (await deps.storage.load()).findLast((e) => e.kind === "check_in" && queueKey(e.habitId, e.subjectId) === key);
    if (!last) return false;
    await queue.undo(last.clientId, habitId);
    // An undo the server has to apply (the tap may have landed) goes out with the next flush; while
    // the tap's online try still runs, once it ends (sendWaitingUndo).
    if (!tryingIds.has(last.clientId) && deps.isOnline() && (await undoWaits(last.clientId))) scheduleFlush();
    return true;
  }

  const undoWaits = async (clientId: string) => (await deps.storage.load()).some((e) => e.kind === "undo" && e.clientId === clientId);
  // A tap's online try ended (answered, failed or aborted): an undo made meanwhile goes out now.
  async function sendWaitingUndo(clientId: string): Promise<void> {
    if (!deps.isOnline() || !(await undoWaits(clientId))) return;
    if (timer !== null) clearTimer(timer);
    timer = null;
    await flush().catch(() => undefined);
  }

  // Reset my data (Settings): the taps and undos still waiting on these habits are dropped first, so
  // none is sent to a habit the reset removes. Other tabs hear about it.
  async function forgetHabits(habitIds: Iterable<string>): Promise<void> {
    await queue.dropHabits(new Set(habitIds));
    deps.channel?.post();
  }

  return {
    queue,
    flush,
    submitTap,
    undoQueued,
    forgetHabits,
    counts: async () => {
      const counts = pendingCounts(await deps.storage.load());
      emit(counts);
      return counts;
    },
    // A live refresh should wait (lib/offline-queue.ts holdsRefresh), as of the last change this tab
    // saw: known before the page draws it (components/habits/live-refresh.tsx).
    holdsRefresh: () => holdsRefresh(waiting, deps.now?.() ?? new Date(), flushing || trying > 0),
    // Everything still waiting on this phone (check-ins and undos), for sign-out.
    pending: async () => (await deps.storage.load()).length,
    // While the page is open: hear other tabs. stop() also cancels a scheduled flush.
    start() {
      stopListening ??= deps.channel?.listen(onOtherTab);
    },
    stop() {
      if (timer !== null) clearTimer(timer);
      timer = null;
      stopListening?.();
      stopListening = undefined;
    },
  };
}

function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  setTimer: (fn: () => void, ms: number) => unknown,
  clearTimer: (t: unknown) => void,
  onTimeout: () => void = () => {},
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimer(() => {
      onTimeout();
      reject(new Error("timeout"));
    }, ms);
    p.then(
      (v) => (clearTimer(t), resolve(v)),
      (e: unknown) => (clearTimer(t), reject(e)),
    );
  });
}
