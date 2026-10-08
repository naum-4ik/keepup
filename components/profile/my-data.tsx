"use client";

import { useId, useRef, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
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
  PREVIEW_RETRY,
  runDelete,
} from "@/lib/my-data";
import { NEEDS_CONNECTION } from "@/lib/offline-copy";
import { clearOfflineCaches, markPagesOwnerDeleted } from "@/lib/offline-pages";
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
// was the last one (public.delete_account_preview). Then lib/my-data.ts runDelete: waiting check-ins
// are sent, the phone is cleared the way sign-out clears it, and the account is deleted.
// A demo login has no Delete account at all (the demo deletes itself after 24 hours); Export stays.
export function MyData({ isDemo = false }: { isDemo?: boolean }) {
  return (
    <section aria-labelledby="my-data-title" className="flex flex-col gap-3 rounded-2xl bg-card p-6 shadow-soft">
      <h2 id="my-data-title" className="text-base font-bold">Your data</h2>
      <p className="text-sm text-muted-foreground">{EXPORT_HINT}</p>
      <ExportMyDataButton />
      {!isDemo && <DeleteAccount />}
    </section>
  );
}

function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [lines, setLines] = useState<string[] | null>(null);
  // The preview loads outside the transition: Cancel and Escape work meanwhile; only the delete holds
  // the dialog open. Until it's in, Delete stays off.
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // The latest preview request: an answer to an earlier one (the dialog closed and opened again) is dropped.
  const request = useRef(0);
  const queue = useOfflineSignOut();
  const inputId = useId();

  async function loadPreview() {
    const id = ++request.current;
    setLines(null);
    setPreviewError(null);
    let next: { lines: string[] } | { error: string };
    try {
      const preview = await deleteAccountPreview();
      next = preview ? { lines: deletePreviewLines(preview) } : { error: GENERIC_ERROR };
    } catch {
      next = { error: navigator.onLine ? GENERIC_ERROR : NEEDS_CONNECTION };
    }
    if (id !== request.current) return;
    if ("lines" in next) setLines(next.lines);
    else setPreviewError(next.error);
  }

  function openDialog() {
    setWord("");
    setError(null);
    setOpen(true);
    void loadPreview();
  }

  function remove() {
    setError(null);
    if (!navigator.onLine) {
      setError(NEEDS_CONNECTION);
      return;
    }
    startTransition(async () => {
      // A successful delete redirects to the landing page: runDelete passes that on, never DELETE_FAILED.
      const message = await runDelete({
        flush: queue.flushQueue,
        // Saved pages, the queue and this phone's push subscription, as at sign-out.
        clearPhone: async () => {
          await signOutCleanup({
            getSubscription: browserSubscription,
            forget: async (endpoint) => void (await forgetPushSubscription(endpoint)),
            clearCaches: clearOfflineCaches,
            deleteQueue: queue.deleteQueue,
          });
          markPagesOwnerDeleted();
        },
        remove: deleteMyAccount,
        rethrow: unstable_rethrow,
      });
      if (message) setError(message);
    });
  }

  function close() {
    request.current++; // a preview still on its way is no longer wanted
    setOpen(false);
  }

  const ready = lines !== null;

  return (
    <>
      <Button type="button" variant="outline" className="h-11 text-destructive hover:text-destructive" onClick={openDialog}>
        Delete account
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && !next && close()}>
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
          {previewError && (
            <div className="flex items-center justify-between gap-2">
              <p role="alert" className="text-sm text-destructive">{previewError}</p>
              <Button type="button" variant="outline" className="h-11 shrink-0" onClick={() => void loadPreview()}>
                {PREVIEW_RETRY}
              </Button>
            </div>
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
              <Button type="button" variant="outline" className="h-11 flex-1" disabled={pending} onClick={close}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" className="h-11 flex-1" disabled={pending || !ready || !isDeleteWord(word)}>
                {pending ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
