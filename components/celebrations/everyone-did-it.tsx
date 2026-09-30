"use client";

import { useEffect } from "react";
import { markSeen } from "@/app/(app)/today/actions";
import { Avatar } from "@/components/avatar";
import { Confetti } from "@/components/celebrations/confetti";

export type CardMember = { id: string; name: string; avatar_emoji: string | null; avatar_color: string | null };

const MAX_SHOWN = 6;

// §7 "Everyone did it! Family dinner ✓", the first time the app opens after it. Several at once
// collapse into one card. Shown once: after a second on screen the rows count as seen, so the next
// render leaves it out (the card itself stays while it's being read).
export function EveryoneDidIt({ ids, habits, members }: { ids: string[]; habits: string[]; members: CardMember[] }) {
  const key = ids.join(",");
  useEffect(() => {
    if (!key) return;
    const timer = window.setTimeout(() => void markSeen(key.split(",")), 1000);
    return () => window.clearTimeout(timer);
  }, [key]);

  return (
    <div className="relative flex items-center gap-3 rounded-2xl bg-card p-4 shadow-soft">
      <Confetti />
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
