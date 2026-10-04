"use client";

import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createOfflineClient, type Channel, type Counts, type TapResult } from "@/lib/offline-client";
import { GENERIC_ERROR } from "@/lib/habit-errors";
import { claimSavedPages, savePageOffline } from "@/lib/offline-pages";
import { deleteOfflineQueue, indexedDbStorage, offlineDbName, type Locks } from "@/lib/offline-queue-store";
import { httpSender } from "@/lib/offline-sync";

type Client = ReturnType<typeof createOfflineClient>;
// queued: check-ins waiting on this phone, per habit and person (lib/offline-queue.ts queueKey).
// ready: the saved queue has been read (until then `queued` is empty, not "nothing waiting").
// notice: a queued check-in was given up after repeated failures (lib/offline-queue.ts MAX_ATTEMPTS).
type Ctx = { client: Client | null; userId: string | null; queued: Counts; ready: boolean; notice: boolean; dismissNotice: () => void };
const NONE: Counts = new Map();
const OfflineQueueContext = createContext<Ctx>({ client: null, userId: null, queued: NONE, ready: false, notice: false, dismissNotice: () => {} });

export function useOfflineQueue() {
  const { queued, ready } = useContext(OfflineQueueContext);
  return { queued, ready };
}

export function useOfflineNotice() {
  const { notice, dismissNotice } = useContext(OfflineQueueContext);
  return { notice, dismiss: dismissNotice };
}

// Sign-out (lib/push-support.ts signOutWithQueue): send what's waiting once, say what's left, then
// delete this person's queue from the phone. Outside the provider there is nothing to send or delete.
export function useOfflineSignOut() {
  const { client, userId } = useContext(OfflineQueueContext);
  return useMemo(
    () => ({
      flushQueue: async () => void (await client?.flush()),
      pendingCount: async () => (client ? client.pending() : 0),
      deleteQueue: async () => {
        client?.stop();
        if (userId) await deleteOfflineQueue(offlineDbName(userId));
      },
    }),
    [client, userId],
  );
}

function broadcast(userId: string): Channel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  const bc = new BroadcastChannel(`keepup-offline-${userId}`);
  return {
    post: () => bc.postMessage("changed"),
    listen: (cb) => {
      bc.onmessage = cb;
      return () => void (bc.onmessage = null);
    },
  };
}

// Taps wait here when they can't be sent (ideas/offline.md §1). One IndexedDB per signed-in person, so
// a phone shared by two accounts keeps their taps apart. Sent when the app opens, comes back online or
// back into view, and a few seconds after a tap that didn't get an answer (no Background Sync, owner
// decision: with the app closed, the next open sends them). navigator.locks makes one tab (or the
// installed app) the only sender at a time; other tabs hear about it and refresh.
export function OfflineQueueProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [queued, setQueued] = useState<Counts>(NONE);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const client = useMemo(() => {
    if (typeof window === "undefined") return null;
    return createOfflineClient({
      storage: indexedDbStorage(offlineDbName(userId)),
      send: httpSender(),
      locks: (navigator as Navigator & { locks?: Locks }).locks ?? null,
      isOnline: () => navigator.onLine,
      onCounts: setQueued,
      onFlushed: ({ counts, changed, poisoned }) => {
        // The saved state and the fresh page land together: clearing "Saving…" before the refresh
        // would flip the card back to open for a moment (and slide it in the kid view).
        startTransition(() => {
          setQueued(counts);
          if (changed) router.refresh();
        });
        if (poisoned > 0) setNotice(true);
        if (changed && navigator.onLine) savePageOffline();
      },
      channel: broadcast(userId),
    });
  }, [userId, router]);

  useEffect(() => {
    if (!client) return;
    let alive = true;
    client.start();
    // Someone else's saved pages go before anything is saved for this person.
    void claimSavedPages(userId).then(() => alive && setClaimed(true));
    client.counts().then(
      () => alive && setReady(true),
      () => alive && setReady(true),
    );
    const flush = () => {
      client.flush().catch((e: unknown) => console.error("offline queue flush", e));
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") flush();
    };
    flush();
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      client.stop();
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [client, userId]);

  // Reached by client-side navigation, no navigation request went through the worker: ask it to save
  // this page (it keeps only Today and the kid view).
  useEffect(() => {
    if (claimed && navigator.onLine) savePageOffline(pathname);
  }, [claimed, pathname]);

  const dismissNotice = useCallback(() => setNotice(false), []);
  const value = useMemo(() => ({ client, userId, queued, ready, notice, dismissNotice }), [client, userId, queued, ready, notice, dismissNotice]);
  return <OfflineQueueContext.Provider value={value}>{children}</OfflineQueueContext.Provider>;
}

type Online = (tap: { clientId: string }) => Promise<{ ok: true } | { ok: false; message: string }>;

// A check-in tap: saved on this phone first, then tried online (lib/offline-client.ts submitTap).
// Once it lands, the saved Today / kid view is refreshed so the offline copy isn't stale.
export function useSubmitTap() {
  const { client } = useContext(OfflineQueueContext);
  return useCallback(
    async (tap: { habitId: string; subjectId?: string | null; byChild?: boolean }, online: Online): Promise<TapResult> => {
      if (!client) return { ok: false, message: GENERIC_ERROR };
      try {
        const r = await client.submitTap(tap, online);
        if (r.ok && !r.queued) savePageOffline();
        return r;
      } catch (e) {
        console.error("check-in tap", e);
        return { ok: false, message: GENERIC_ERROR };
      }
    },
    [client],
  );
}
