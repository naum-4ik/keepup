"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { markSeen } from "@/app/(app)/today/actions";
import { AvatarRow, type CardMember } from "@/components/celebrations/everyone-did-it";

// §7 group streak milestones: a card with everyone's avatars (never full-screen). It stays until
// dismissed; dismissing marks it seen.
export function GroupMilestoneCard({ id, group, text, members }: { id: string; group: string; text: string; members: CardMember[] }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-soft">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-xs font-semibold text-muted-foreground">{group}</p>
        <p className="font-bold">{text}</p>
        <AvatarRow members={members} />
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          setHidden(true);
          void markSeen([id]);
        }}
        className="-mr-2 flex size-11 shrink-0 items-center justify-center self-start rounded-full text-muted-foreground hover:bg-muted"
      >
        <X aria-hidden className="size-5" />
      </button>
    </div>
  );
}
