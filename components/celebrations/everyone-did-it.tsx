"use client";

import { useEffect, useState } from "react";
import { markSeen } from "@/app/(app)/today/actions";
import { Avatar } from "@/components/avatar";
import { Confetti } from "@/components/celebrations/confetti";

export type CardMember = { id: string; name: string; avatar_emoji: string | null; avatar_color: string | null };

const MAX_SHOWN = 6;

type Props = { ids: string[]; habits: string[]; members: CardMember[] };

// §7 "Everyone did it! Family dinner ✓", the first time the app opens after it. Several at once
// collapse into one card. Shown once: after a second actually on screen the rows count as seen, so
// the next page load leaves it out. A render in a background tab (e.g. a live refresh) waits for the
// tab to be visible, and so does the confetti.
// Today renders this always (no ids: nothing to show). A refresh after the rows were marked seen (a
// live update, coming back to the tab, Realtime's catch-up) sends no ids, so the card keeps what it
// showed, confetti included, until the page is left: it stays while it's being read (`data-seen`).
export function EveryoneDidIt(props: Props) {
  const [kept, setKept] = useState<Props>(props);
  if (props.ids.length > 0 && props.ids.join(",") !== kept.ids.join(",")) setKept(props);
  const { ids, habits, members } = props.ids.length > 0 ? props : kept;
  const key = ids.join(",");
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!key) return;
    let timer: number | null = null;
    const arm = () => {
      setShown(true);
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        if (document.visibilityState === "visible") {
          document.removeEventListener("visibilitychange", onVisible);
          void markSeen(key.split(","));
        }
      }, 1000);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") arm();
      else if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    if (document.visibilityState === "visible") arm();
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (timer) window.clearTimeout(timer);
    };
  }, [key]);

  if (ids.length === 0) return null;
  return (
    <div data-seen={props.ids.length === 0 ? "" : undefined} className="relative flex items-center gap-3 rounded-2xl bg-card p-4 shadow-soft">
      {/* Keyed by the rows: a new card (new ids while a kept one shows) bursts again. */}
      {shown && <Confetti key={key} />}
      <p className="min-w-0 flex-1 font-bold">Everyone did it! {habits.map((h) => `${h} ✓`).join(" · ")}</p>
      <AvatarRow members={members} />
    </div>
  );
}

export function AvatarRow({ members }: { members: CardMember[] }) {
  if (members.length === 0) return null;
  const shown = members.slice(0, MAX_SHOWN);
  return (
    <span className="flex shrink-0 -space-x-2">
      {shown.map((m) => (
        <Avatar key={m.id} name={m.name} emoji={m.avatar_emoji} color={m.avatar_color} className="ring-2 ring-card" />
      ))}
      {members.length > shown.length && (
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold ring-2 ring-card">
          +{members.length - shown.length}
        </span>
      )}
    </span>
  );
}
