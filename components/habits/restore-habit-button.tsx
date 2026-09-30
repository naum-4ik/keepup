"use client";

import { ArchiveRestore } from "lucide-react";
import { useState, useTransition } from "react";
import { restoreHabit } from "@/app/(app)/habits/actions";

// Archived tab and an archived habit's page: back on Today, history kept.
export function RestoreHabitButton({ habitId, title }: { habitId: string; title: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-label={`Restore ${title}`}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await restoreHabit(habitId); // redirects to Today on success
            if (r && !r.ok) setError(r.message);
          })
        }
        className="flex h-11 items-center gap-1.5 self-start rounded-full px-3 text-sm font-semibold text-primary hover:bg-accent"
      >
        <ArchiveRestore aria-hidden className="size-4" />
        {pending ? "Restoring…" : "Restore"}
      </button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
