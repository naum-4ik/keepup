"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOfflineQueue } from "@/components/offline/offline-queue-provider";
import { createClient } from "@/lib/supabase/client";

// Live updates (spec: Today, habit detail and Inbox). Realtime applies RLS, so this only hears rows
// the user may read. Refreshing re-runs the Server Components, which stay the source of truth.
// Changes made while nobody was listening (the app in the background, a dropped connection) aren't
// replayed, so the page also refreshes when it comes back into view and when the channel rejoins.
export function LiveRefresh({ table, filter }: { table: "check_ins" | "notifications"; filter: string }) {
  const router = useRouter();
  const timer = useRef<number | null>(null);
  // Exposed as data-live on a hidden span: "ready" once changes are actually streaming (tests wait
  // for it before another browser writes, so the change can't land before anyone is listening).
  // SUBSCRIBED alone is too early: the server confirms the postgres_changes listener separately
  // ("Subscribed to PostgreSQL", seconds later on a cold start), and changes before that are lost.
  const [ready, setReady] = useState(false);
  // While a tap or an undo waits on this phone, a refresh would draw the server's answer in its place
  // ("Done" for a tap still saving): the refresh is owed instead, and runs once the queue is empty.
  // isBusy() is read when a refresh is due, so a tap doesn't re-join the channel; `queued` (drawn)
  // runs the owed refresh once nothing waits.
  const { queued, isBusy } = useOfflineQueue();
  const owed = useRef(false);
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let closed = false;
    // Offline, a refresh would replace the saved page with an error.
    const refreshSoon = () => {
      if (!navigator.onLine) return;
      if (isBusy()) {
        owed.current = true;
        return;
      }
      if (timer.current) window.clearTimeout(timer.current);
      // Checked again when it fires: the layout's listener (on every page) can confirm late, and the
      // phone may have gone offline in those 400 ms.
      timer.current = window.setTimeout(() => {
        if (!navigator.onLine) return;
        if (isBusy()) owed.current = true;
        else router.refresh();
      }, 400);
    };
    refreshRef.current = refreshSoon;
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshSoon();
    };
    document.addEventListener("visibilitychange", onVisible);
    // Hand Realtime the user's token before joining: a join without it runs as anon, and RLS (and the
    // filter's column check) then refuse the subscription.
    void supabase.realtime.setAuth().then(() => {
      if (closed) return;
      let ch = supabase.channel(`live:${table}:${filter}`).on("postgres_changes", { event: "*", schema: "public", table, filter }, refreshSoon);
      // Realtime can't filter DELETE events, so the filtered listener never hears an undo (a hard
      // delete). Check-ins also listen for every delete: the payload is only the row's id, and a stray
      // refresh just re-reads what this person may see.
      if (table === "check_ins") ch = ch.on("postgres_changes", { event: "DELETE", schema: "public", table }, refreshSoon);
      channel = ch
        .on("system", {}, (p: { extension?: string; status?: string }) => {
          if (closed || p.extension !== "postgres_changes" || p.status !== "ok") return;
          setReady(true);
          // Changes stream from here on. Catch up on what landed before: between the page's render
          // and this first confirmation, or while a dropped channel rejoined.
          refreshSoon();
        })
        .subscribe((status) => {
          if (!closed && status !== "SUBSCRIBED") setReady(false);
        });
    }).catch((e: unknown) => {
      // No live updates this time; the page still works and refreshes on navigation.
      console.error("realtime setAuth failed", e);
    });
    return () => {
      closed = true;
      setReady(false);
      document.removeEventListener("visibilitychange", onVisible);
      if (timer.current) window.clearTimeout(timer.current);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [table, filter, router, isBusy]);

  useEffect(() => {
    if (owed.current && !isBusy()) {
      owed.current = false;
      refreshRef.current();
    }
  }, [queued, isBusy]);

  // data-table: a page can have two listeners (the layout's notifications plus a page's check-ins).
  return <span hidden data-live={ready ? "ready" : "joining"} data-table={table} />;
}
