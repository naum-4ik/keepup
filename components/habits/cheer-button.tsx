"use client";

import { useState, useTransition } from "react";
import { cheer } from "@/app/(app)/inbox/actions";
import { Button } from "@/components/ui/button";

// A one-way toggle: cheering can't be taken back (the author already got the note).
export function CheerButton({ checkInId, habitId, name, cheered }: { checkInId: string; habitId: string; name: string; cheered: boolean }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(cheered);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        aria-pressed={done}
        className="h-11 rounded-full px-4 aria-pressed:border-[#F6D2BE] aria-pressed:bg-accent aria-pressed:opacity-100"
        disabled={done || pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await cheer(checkInId, habitId);
            if (r.ok) setDone(true);
            else setError(r.message ?? null);
          })
        }
      >
        {done ? "Cheered" : "Cheer ❤️"}
        <span className="sr-only"> {name}</span>
      </Button>
      {error && (
        <p role="alert" className="max-w-48 text-right text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
