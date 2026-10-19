"use client";

import { useState, useTransition, type ReactNode } from "react";
import { cheer } from "@/app/(app)/inbox/actions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
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
            if (!navigator.onLine) return setError(t("habits.sendFailed"));
            try {
              const r = await cheer(checkInId, habitId);
              if (r.ok) setDone(true);
              else setError(r.message ?? null);
            } catch {
              setError(t("habits.sendFailed"));
            }
          })
        }
      >
        {rich(done ? "habits.cheer.done" : pending ? "habits.cheer.sending" : "habits.cheer.cta", { name, sr: srOnly })}
      </Button>
      {error && (
        <Notice tone="error" live className="max-w-56">
          {error}
        </Notice>
      )}
    </div>
  );
}
