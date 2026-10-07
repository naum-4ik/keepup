"use client";

import { useId, useState, useTransition } from "react";
import { deleteAccountPreview, deleteMyAccount, exportMyData } from "@/app/(app)/profile/settings/actions";
import { forgetPushSubscription } from "@/app/(app)/profile/settings/notification-actions";
import { useOfflineSignOut } from "@/components/offline/offline-queue-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { downloadJson } from "@/lib/download-json";
import { GENERIC_ERROR } from "@/lib/habit-errors";
import {
  DELETE_BODY,
  DELETE_TITLE,
  DELETE_WORD,
  deletePreviewLines,
  EXPORT_FIRST,
  EXPORT_HINT,
  isDeleteWord,
  myDataFileName,
} from "@/lib/my-data";
import { NEEDS_CONNECTION } from "@/lib/offline-copy";
import { clearOfflineCaches, forgetPagesOwner } from "@/lib/offline-pages";
import { browserSubscription, signOutCleanup } from "@/lib/push-support";

// Saves everything Keepup keeps about this person as keepup-my-data-{date}.json.
function ExportMyDataButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await exportMyData();
            if (!r.ok) return setError(r.message);
            setError(null);
            downloadJson(myDataFileName(new Date()), r.data);
          })
        }
      >
        {pending ? "Exporting…" : "Export my data"}
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

// Settings → Your data (M6). Delete account works like Reset my data: typing "delete" guards the
// button. The dialog says which groups go with the account and who becomes admin where this person
// was the last one (public.delete_account_preview). The phone is cleared before the delete, the way
// sign-out clears it (the action redirects, so nothing runs after it on success).
export function MyData() {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [lines, setLines] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const queue = useOfflineSignOut();
  const inputId = useId();

  function openDialog() {
    setWord("");
    setError(null);
    setLines(null);
    setOpen(true);
    startTransition(async () => {
      try {
        const preview = await deleteAccountPreview();
        if (!preview) return setError(GENERIC_ERROR);
        setLines(deletePreviewLines(preview));
      } catch {
        setError(navigator.onLine ? GENERIC_ERROR : NEEDS_CONNECTION);
      }
    });
  }

  function remove() {
    setError(null);
    if (!navigator.onLine) {
      setError(NEEDS_CONNECTION);
      return;
    }
    startTransition(async () => {
      try {
        // Waiting check-ins, saved pages and this phone's push subscription go first.
        await signOutCleanup({
          getSubscription: browserSubscription,
          forget: async (endpoint) => void (await forgetPushSubscription(endpoint)),
          clearCaches: clearOfflineCaches,
          deleteQueue: queue.deleteQueue,
        });
        forgetPagesOwner();
        const r = await deleteMyAccount();
        // On success the action redirects to the landing page.
        if (r && !r.ok) setError(r.message);
      } catch {
        setError(navigator.onLine ? GENERIC_ERROR : NEEDS_CONNECTION);
      }
    });
  }

  const ready = lines !== null;

  return (
    <section aria-labelledby="my-data-title" className="flex flex-col gap-3 rounded-2xl bg-card p-6 shadow-soft">
      <h2 id="my-data-title" className="text-base font-bold">Your data</h2>
      <p className="text-sm text-muted-foreground">{EXPORT_HINT}</p>
      <ExportMyDataButton />
      <Button type="button" variant="outline" className="h-11 text-destructive hover:text-destructive" onClick={openDialog}>
        Delete account
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <div className="flex flex-col gap-1 pr-10">
            <DialogTitle>{DELETE_TITLE}</DialogTitle>
            <DialogDescription>{DELETE_BODY}</DialogDescription>
          </div>
          {lines && lines.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm">
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          <p className="text-sm text-muted-foreground">{EXPORT_FIRST}</p>
          <ExportMyDataButton />
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (ready && isDeleteWord(word) && !pending) remove();
            }}
          >
            <label htmlFor={inputId} className="text-sm font-semibold">
              Type &ldquo;{DELETE_WORD}&rdquo; to confirm
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
              <Button type="submit" variant="destructive" className="h-11 flex-1" disabled={pending || !ready || !isDeleteWord(word)}>
                {pending && ready ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
