"use client";

import { useState, useTransition, type ReactNode } from "react";
import { cheer } from "@/app/(app)/inbox/actions";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

// The name follows the button word for screen readers only (rich tag <sr>).
const srOnly = (c: ReactNode) => <span className="sr-only">{c}</span>;

// A one-way toggle: cheering can't be taken back (the author already got the note).
export function CheerButton({ checkInId, habitId, name, cheered }: { checkInId: string; habitId: string; name: string; cheered: boolean }) {
  const { t, rich } = useT();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(cheered);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-inner">
      <Button
        type="button"
        variant="outline"
        aria-pressed={done}
        className="h-11 rounded-full px-item aria-pressed:border-flame/40 aria-pressed:bg-accent aria-pressed:opacity-100"
        disabled={done || pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            // Offline, or the request never came back (a thrown action): it needs the server.
            if (!navigator.onLine) return setError(t("offline.needsConnection"));
            try {
              const r = await cheer(checkInId, habitId);
              if (r.ok) setDone(true);
              else setError(r.message ?? null);
            } catch {
              setError(t("offline.needsConnection"));
            }
          })
        }
      >
        {rich(done ? "habits.cheer.done" : "habits.cheer.cta", { name, sr: srOnly })}
      </Button>
      {error && (
        <p role="alert" className="max-w-48 text-end text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
