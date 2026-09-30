"use client";

import { RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { startAgain } from "@/app/(app)/habits/actions";

// Finished tab: a fresh copy with the same settings and length, from today (history stays on the old one).
export function StartAgainButton({ habitId, title }: { habitId: string; title: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-label={`Start ${title} again`}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await startAgain(habitId); // redirects to Today on success
            if (r && !r.ok) setError(r.message);
          })
        }
        className="flex h-11 items-center gap-1.5 self-start rounded-full px-3 text-sm font-semibold text-primary hover:bg-accent"
      >
        <RotateCcw aria-hidden className="size-4" />
        {pending ? "Starting…" : "Start again"}
      </button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
