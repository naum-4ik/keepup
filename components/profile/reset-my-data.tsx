"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetMyData } from "@/app/(app)/profile/settings/actions";
import { useForgetOfflineHabits } from "@/components/offline/offline-queue-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GENERIC_ERROR } from "@/lib/habit-errors";
import { NEEDS_CONNECTION } from "@/lib/offline-copy";
import { isResetWord, RESET_CLEARS, RESET_KEEPS, RESET_WORD } from "@/lib/reset-my-data";

// Settings → Reset my data (owner 2026-10-06): a fresh start that keeps the account and the family.
// The database decides what goes (public.reset_my_data); typing "reset" guards the button. Once it
// has, the waiting taps on the private habits and the saved offline pages leave the phone (if it
// fails, nothing on the phone is lost).
export function ResetMyData({ privateHabitIds }: { privateHabitIds: string[] }) {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const forgetOffline = useForgetOfflineHabits();
  const router = useRouter();
  const inputId = useId();

  function reset() {
    setError(null);
    if (!navigator.onLine) {
      setError(NEEDS_CONNECTION);
      return;
    }
    startTransition(async () => {
      try {
        const r = await resetMyData();
        if (!r.ok) return setError(r.message);
        try {
          await forgetOffline(privateHabitIds);
        } catch (e) {
          // The reset happened; a leftover tap on a removed habit is refused when it syncs.
          console.error("reset: clearing the phone's queue", e);
        }
        router.replace("/today?reset=1");
      } catch {
        setError(navigator.onLine ? GENERIC_ERROR : NEEDS_CONNECTION);
      }
    });
  }

  return (
    <section aria-labelledby="reset-my-data-title" className="flex flex-col gap-3 rounded-2xl bg-card p-6 shadow-soft">
      <h2 id="reset-my-data-title" className="text-base font-bold">Reset my data</h2>
      <p className="text-sm text-muted-foreground">{RESET_CLEARS}</p>
      <p className="text-sm text-muted-foreground">{RESET_KEEPS}</p>
      <Button
        type="button"
        variant="outline"
        className="h-11 text-destructive hover:text-destructive"
        onClick={() => {
          setWord("");
          setError(null);
          setOpen(true);
        }}
      >
        Reset my data
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <div className="flex flex-col gap-1 pr-10">
            <DialogTitle>Reset your data?</DialogTitle>
            <DialogDescription>
              {RESET_CLEARS} {RESET_KEEPS} This can&apos;t be undone.
            </DialogDescription>
          </div>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (isResetWord(word) && !pending) reset();
            }}
          >
            <label htmlFor={inputId} className="text-sm font-semibold">
              Type &ldquo;{RESET_WORD}&rdquo; to confirm
            </label>
            <Input
              id={inputId}
              value={word}
              onChange={(e) => setWord(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="h-11"
            />
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="h-11 flex-1" disabled={pending} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" className="h-11 flex-1" disabled={pending || !isResetWord(word)}>
                {pending ? "Resetting…" : "Reset"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
