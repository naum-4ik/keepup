"use client";

import { createContext, startTransition, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createOfflineClient, type Channel, type Counts, type TapResult } from "@/lib/offline-client";
import { GENERIC_ERROR } from "@/lib/habit-errors";
import { claimSavedPages, clearSavedPages, savePageOffline } from "@/lib/offline-pages";
import { queuedDelta, type ShownPeriods } from "@/lib/offline-queue";
import { deleteOfflineQueue, indexedDbStorage, offlineDbName, type Locks } from "@/lib/offline-queue-store";
import { httpSender, tapSender } from "@/lib/offline-sync";
import type { TapPeriods } from "@/lib/rendered-taps";

type Client = ReturnType<typeof createOfflineClient>;
// queued: check-ins waiting on this phone, per habit and person (lib/offline-queue.ts queueKey).
// ready: the saved queue has been read (until then `queued` is empty, not "nothing waiting").
// notice: a queued check-in was given up after repeated failures (lib/offline-queue.ts MAX_ATTEMPTS).
// delta: what the waiting entries change on this page's counts (lib/offline-queue.ts queuedDelta):
// signed, so a waiting undo of a counted tap takes it back. busy: anything waits (taps or undos), as
// drawn. holdsRefresh(): a live refresh should wait (lib/offline-queue.ts holdsRefresh), known at once
// (the drawn state can wait behind a running check-in).
type Ctx = {
  client: Client | null; userId: string | null; queued: Counts; delta: ReadonlyMap<string, number>; busy: boolean; holdsRefresh: () => boolean;
  ready: boolean; notice: boolean; dismissNotice: () => void; setRendered: (drawn: Drawn) => void;
};
// What the page was drawn with: its check-ins' client ids, and each habit's shown period.
type Drawn = { ids: ReadonlySet<string>; periods: ShownPeriods | null };
const NONE: Counts = new Map();
const OfflineQueueContext = createContext<Ctx>({
  client: null, userId: null, queued: NONE, delta: NONE, busy: false, holdsRefresh: () => false, ready: false, notice: false, dismissNotice: () => {},
  setRendered: () => {},
});

// queued: presence (shows "Saving…" and Undo); delta: the counts to draw.
export function useOfflineQueue() {
  const { queued, delta, busy, holdsRefresh, ready } = useContext(OfflineQueueContext);
  return { queued, delta, busy, holdsRefresh, ready };
}

// The client ids of the check-ins a page was drawn with (lib/rendered-taps.ts renderedTapIds), so a
// waiting tap the page already counts isn't added again, and a waiting undo of one takes it back.
// periods (lib/rendered-taps.ts tapPeriods): the period each habit's counts are for, so a waiting tap
// from an earlier period doesn't add to this one. A layout effect: set before the browser paints the
// new page, so no frame counts a tap twice.
export function RenderedTaps({ ids, periods }: { ids: string[]; periods?: TapPeriods }) {
  const { setRendered } = useContext(OfflineQueueContext);
  const key = ids.join(",");
  const periodsKey = periods ? JSON.stringify(periods) : "";
  useLayoutEffect(() => {
    setRendered({
      ids: new Set(key ? key.split(",") : []),
      periods: periodsKey ? new Map(Object.entries(JSON.parse(periodsKey) as TapPeriods)) : null,
    });
  }, [key, periodsKey, setRendered]);
  return null;
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
  const [rendered, setRendered] = useState<Drawn | null>(null);
  const client = useMemo(() => {
    if (typeof window === "undefined") return null;
    return createOfflineClient({
      storage: indexedDbStorage(offlineDbName(userId)),
      send: httpSender(),
      locks: (navigator as Navigator & { locks?: Locks }).locks ?? null,
      isOnline: () => navigator.onLine,
      // In a transition, like the flush below. When an online tap lands (landed), the queue forgets it
      // and the page is refreshed in the same transition: applied together, the Today card and the
      // buttons never count that tap twice (the refreshed count plus the queued one), nor drop it.
      onCounts: (counts, landed) =>
        startTransition(() => {
          setQueued(counts);
          if (landed) router.refresh();
        }),
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
  // Known at once: a check-in's transition holds `queued` back until its online try ends, but a live
  // refresh must know right away that a tap waits (components/habits/live-refresh.tsx).
  const holdsRefresh = useCallback(() => client?.holdsRefresh() ?? false, [client]);

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
  const delta = useMemo(() => queuedDelta(queued.queue ?? [], rendered?.ids ?? null, rendered?.periods ?? null), [queued, rendered]);
  const busy = (queued.queue?.length ?? 0) > 0;
  const value = useMemo(
    () => ({ client, userId, queued, delta, busy, holdsRefresh, ready, notice, dismissNotice, setRendered }),
    [client, userId, queued, delta, busy, holdsRefresh, ready, notice, dismissNotice],
  );
  return <OfflineQueueContext.Provider value={value}>{children}</OfflineQueueContext.Provider>;
}

// Undo next to "Saving…" (lib/offline-client.ts undoQueued): the card shows open again at once.
export function useUndoQueuedTap() {
  const { client } = useContext(OfflineQueueContext);
  return useCallback(
    async (habitId: string, subjectId: string | null = null): Promise<void> => {
      try {
        await client?.undoQueued(habitId, subjectId);
      } catch (e) {
        console.error("undo queued tap", e);
      }
    },
    [client],
  );
}

// Reset my data (components/profile/reset-my-data.tsx): drop what waits on these habits from this
// phone, and the saved pages, before the reset runs.
export function useForgetOfflineHabits() {
  const { client } = useContext(OfflineQueueContext);
  return useCallback(
    async (habitIds: string[]): Promise<void> => {
      await client?.forgetHabits(habitIds);
      await clearSavedPages();
    },
    [client],
  );
}

const sendTap = tapSender();

// A check-in tap: saved on this phone first, then tried online (lib/offline-client.ts submitTap,
// app/api/check-ins/tap). Once it lands, the saved Today / kid view is refreshed so the offline copy
// isn't stale. subjectId: a child's tap; byChild: made in the kid view.
export function useSubmitTap() {
  const { client } = useContext(OfflineQueueContext);
  return useCallback(
    async (tap: { habitId: string; subjectId?: string | null; byChild?: boolean }): Promise<TapResult> => {
      if (!client) return { ok: false, message: GENERIC_ERROR };
      try {
        const r = await client.submitTap(tap, ({ clientId }, signal) =>
          sendTap({ clientId, habitId: tap.habitId, subjectId: tap.subjectId ?? null, ...(tap.byChild ? { byChild: true } : {}) }, signal),
        );
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
