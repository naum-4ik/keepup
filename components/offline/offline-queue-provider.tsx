"use client";

import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createOfflineQueue, indexedDbStorage, memoryStorage, type Locks } from "@/lib/offline-queue-store";
import { httpSender } from "@/lib/offline-sync";

type Queue = ReturnType<typeof createOfflineQueue>;
// queued: check-ins waiting on this phone, per habit and person (lib/offline-queue.ts queueKey).
// ready: the saved queue has been read (until then `queued` is empty, not "nothing waiting").
type Ctx = { queue: Queue | null; queued: ReadonlyMap<string, number>; ready: boolean };
const NONE: ReadonlyMap<string, number> = new Map();
const OfflineQueueContext = createContext<Ctx>({ queue: null, queued: NONE, ready: false });

export function useOfflineQueue() {
  const { queued, ready } = useContext(OfflineQueueContext);
  return { queued, ready };
}

type Counts = ReadonlyMap<string, number>;
// Who the saved pages (sw.js "keepup-pages") belong to, on this device.
const PAGES_OWNER = "keepup-pages-owner";

// The queue for one person, and a flush that holds back its own changes until it is done, so the
// caller can apply them together with the page refresh.
function makeQueue(userId: string, onChange: (counts: Counts) => void) {
  const storage = "indexedDB" in window ? indexedDbStorage(`keepup-offline-${userId}`) : memoryStorage();
  const locks = (navigator as Navigator & { locks?: Locks }).locks ?? null;
  let flushing = false;
  let latest: Counts | null = null;
  const queue = createOfflineQueue({
    storage,
    send: httpSender(),
    locks,
    onChange: (counts) => {
      if (flushing) latest = counts;
      else onChange(counts);
    },
  });
  async function flush(): Promise<{ counts: Counts; changed: boolean }> {
    flushing = true;
    latest = null;
    try {
      const r = await queue.flush();
      return { counts: latest ?? (await queue.counts()), changed: r.synced.length + r.rejected.length + r.dropped.length > 0 };
    } finally {
      flushing = false;
    }
  }
  return { queue, flush };
}

// Taps made offline wait here (ideas/offline.md §1). One IndexedDB per signed-in person, so a phone
// shared by two accounts keeps their taps apart. Sent when the app opens, comes back online or back
// into view (no Background Sync, owner decision: with the app closed, the next open sends them).
// navigator.locks makes one tab (or the installed app) the only sender at a time.
export function OfflineQueueProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const router = useRouter();
  const [queued, setQueued] = useState<Counts>(NONE);
  const [ready, setReady] = useState(false);
  const offline = useMemo(() => (typeof window === "undefined" ? null : makeQueue(userId, setQueued)), [userId]);

  // A shared phone: if someone else's saved Today or kid view is still here (their session ended
  // without signing out), it must never show offline for this person.
  useEffect(() => {
    try {
      const owner = localStorage.getItem(PAGES_OWNER);
      if (owner && owner !== userId && "caches" in window) void caches.delete("keepup-pages");
      localStorage.setItem(PAGES_OWNER, userId);
    } catch {
      // no storage (private mode): nothing saved to protect either way
    }
  }, [userId]);

  useEffect(() => {
    if (!offline) return;
    let alive = true;
    const flush = async () => {
      if (!navigator.onLine) return;
      try {
        const { counts, changed } = await offline.flush();
        if (!alive) return;
        // The saved state and the fresh page land together: clearing "Saving…" before the refresh
        // would flip the card back to open for a moment (and slide it in the kid view).
        startTransition(() => {
          setQueued(counts);
          if (changed) router.refresh();
        });
      } catch (e) {
        console.error("offline queue flush", e);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void flush();
    };
    void offline.queue.counts().then(
      (c) => {
        if (!alive) return;
        setQueued(c);
        setReady(true);
      },
      () => alive && setReady(true),
    );
    void flush();
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [offline, router]);

  const value = useMemo(() => ({ queue: offline?.queue ?? null, queued, ready }), [offline, queued, ready]);
  return <OfflineQueueContext.Provider value={value}>{children}</OfflineQueueContext.Provider>;
}

export type QueuedTap = { habitId: string; subjectId?: string | null; byChild?: boolean; clientId: string; tappedAt: string };

// Saves a tap on this phone, under the client id (and tap time) the button already made.
export function useQueueTap() {
  const { queue } = useContext(OfflineQueueContext);
  return useCallback(
    async (tap: QueuedTap) => {
      if (!queue) throw new Error("offline queue unavailable");
      await queue.checkIn(tap.habitId, tap.subjectId ?? null, { clientId: tap.clientId, byChild: tap.byChild, tappedAt: tap.tappedAt });
    },
    [queue],
  );
}
