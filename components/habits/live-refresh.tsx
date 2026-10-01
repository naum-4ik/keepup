"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Live updates (spec: Today, habit detail and Inbox). Realtime applies RLS, so this only hears rows
// the user may read. Refreshing re-runs the Server Components, which stay the source of truth.
// Changes made while nobody was listening (the app in the background, a dropped connection) aren't
// replayed, so the page also refreshes when it comes back into view and when the channel rejoins.
export function LiveRefresh({ table, filter }: { table: "check_ins" | "notifications"; filter: string }) {
  const router = useRouter();
  const timer = useRef<number | null>(null);
  // Exposed as data-live on a hidden span: "ready" once the channel has joined (tests wait for it
  // before another browser writes, so the change can't land before anyone is listening).
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let closed = false;
    let joins = 0;
    const refreshSoon = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => router.refresh(), 400);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshSoon();
    };
    document.addEventListener("visibilitychange", onVisible);
    // Hand Realtime the user's token before joining: a join without it runs as anon, and RLS (and the
    // filter's column check) then refuse the subscription.
    void supabase.realtime.setAuth().then(() => {
      if (closed) return;
      channel = supabase
        .channel(`live:${table}:${filter}`)
        .on("postgres_changes", { event: "*", schema: "public", table, filter }, refreshSoon)
        .subscribe((status) => {
          if (closed) return;
          setReady(status === "SUBSCRIBED");
          // A rejoin after a drop: catch up on what changed in between.
          if (status === "SUBSCRIBED" && ++joins > 1) refreshSoon();
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
  }, [table, filter, router]);

  return <span hidden data-live={ready ? "ready" : "joining"} />;
}
