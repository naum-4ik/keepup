// lib/offline-queue-store.ts
// Persistence and a single-runner flush for the offline queue. Browser-only at runtime (IndexedDB);
// tests use fake-indexeddb or memoryStorage.
import {
  addCheckIn,
  addUndo,
  flush as flushQueue,
  pendingCounts,
  pendingHabitIds,
  undoneIds,
  type FlushResult,
  type QueueEntry,
  type Sender,
} from "./offline-queue";

export interface QueueStorage {
  load(): Promise<QueueEntry[]>;
  save(queue: QueueEntry[]): Promise<void>;
  // Read, change and write in one step, so a tap made while a flush finishes (or in another tab) is
  // never overwritten. `change` must be synchronous.
  update(change: (queue: QueueEntry[]) => QueueEntry[]): Promise<QueueEntry[]>;
}

export function memoryStorage(initial: QueueEntry[] = []): QueueStorage {
  let entries = initial;
  return {
    load: async () => entries,
    save: async (q) => void (entries = q),
    update: async (change) => (entries = change(entries)),
  };
}

const STORE = "queue";
const KEY = "entries";

function openDb(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(db: IDBDatabase, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = op(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function indexedDbStorage(dbName = "keepup-offline"): QueueStorage {
  const db = openDb(dbName);
  return {
    load: async () => ((await run(await db, "readonly", (s) => s.get(KEY))) as QueueEntry[] | undefined) ?? [],
    save: async (queue) => void (await run(await db, "readwrite", (s) => s.put(queue, KEY))),
    // One readwrite transaction: IndexedDB runs overlapping ones one after another, across tabs too.
    update: async (change) => {
      const tx = (await db).transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      return new Promise<QueueEntry[]>((resolve, reject) => {
        let next: QueueEntry[] = [];
        const get = store.get(KEY);
        get.onsuccess = () => {
          next = change((get.result as QueueEntry[] | undefined) ?? []);
          store.put(next, KEY);
        };
        tx.oncomplete = () => resolve(next);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    },
  };
}

// The part of the Web Locks API the queue uses (navigator.locks). One lock name for every tab and
// the installed app, so only one of them sends at a time.
export type Locks = {
  request<T>(name: string, options: { ifAvailable?: boolean }, callback: (lock: unknown) => Promise<T>): Promise<T>;
};
const LOCK = "keepup-offline-queue";

export function createOfflineQueue(deps: {
  storage: QueueStorage;
  send: Sender;
  now?: () => Date;
  newId?: () => string;
  // Waiting check-ins per habit, after every change.
  onChange?: (pending: Map<string, number>) => void;
  // navigator.locks in the browser; without it, one sender per tab (the in-tab runner below).
  locks?: Locks | null;
}) {
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? (() => crypto.randomUUID());
  let running: Promise<FlushResult> | null = null;

  async function update(change: (q: QueueEntry[]) => QueueEntry[]): Promise<void> {
    const next = await deps.storage.update(change);
    deps.onChange?.(pendingCounts(next));
  }

  const key = (e: QueueEntry) => `${e.kind}:${e.clientId}`;

  async function flushOnce(): Promise<FlushResult> {
    // Read inside the lock: another tab may have just sent (and removed) some of it.
    const snapshot = await deps.storage.load();
    const result = await flushQueue(snapshot, deps.send);
    const finished = new Set([...result.synced, ...result.rejected, ...result.dropped].map(key));
    const undone = undoneIds([...result.synced, ...result.rejected]);
    // Entries added while sending stay; only what this run finished leaves, and any check-in whose
    // undo the server already has (it must not be sent again).
    await update((q) => q.filter((e) => !finished.has(key(e)) && !(e.kind === "check_in" && undone.has(e.clientId))));
    return result;
  }

  // Undo of a check-in that may be sending right now: while a flush runs (in this tab, or in any tab
  // when the lock is held), every queued check-in counts as in flight and the undo is queued after it;
  // the server may already have it. Otherwise an unsent check-in is simply removed.
  const allIds = (q: QueueEntry[]) => new Set(q.map((e) => e.clientId));
  function undoEntry(clientId: string, habitId: string): Promise<void> {
    const entry = { kind: "undo" as const, clientId, habitId };
    if (!deps.locks) return update((q) => addUndo(q, entry, running ? allIds(q) : new Set()));
    return deps.locks.request(LOCK, { ifAvailable: true }, (lock) => update((q) => addUndo(q, entry, lock && !running ? new Set() : allIds(q))));
  }

  return {
    // opts.clientId and opts.tappedAt: a tap that was already sent once (the request never came back)
    // keeps its id, so the server can tell a resend from a new tap, and the time it was tapped.
    async checkIn(
      habitId: string,
      subjectId: string | null = null,
      opts: { clientId?: string; byChild?: boolean; tappedAt?: string } = {},
    ): Promise<string> {
      const clientId = opts.clientId ?? newId();
      const tappedAt = opts.tappedAt ?? now().toISOString();
      await update((q) => addCheckIn(q, { kind: "check_in", clientId, habitId, subjectId, tappedAt, ...(opts.byChild ? { byChild: true } : {}) }));
      return clientId;
    },
    undo: undoEntry,
    flush(): Promise<FlushResult> {
      running ??= (deps.locks ? deps.locks.request(LOCK, {}, flushOnce) : flushOnce()).finally(() => (running = null));
      return running;
    },
    pending: async () => pendingHabitIds(await deps.storage.load()),
    counts: async () => pendingCounts(await deps.storage.load()),
  };
}
