"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { dismissCard } from "@/app/(app)/today/actions";

// §7 weekly family recap, on the first day of the group's week: wins only. At the top of the Inbox's
// Activity tab (owner 2026-10-04: no group cards on Today).
export function FamilyRecapCard({ cardKey, group, line }: { cardKey: string; group: string; line: string }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-soft">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-xs font-semibold text-muted-foreground">{group}</p>
        <p className="font-bold">{line}</p>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          setHidden(true);
          void dismissCard(cardKey);
        }}
        className="-mr-2 flex size-11 shrink-0 items-center justify-center self-start rounded-full text-muted-foreground hover:bg-muted"
      >
        <X aria-hidden className="size-5" />
      </button>
    </div>
  );
}
