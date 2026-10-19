"use client";

import { useId, useRef, useState, useTransition, type ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { deleteAccountPreview, deleteMyAccount, exportMyData } from "@/app/(app)/profile/settings/actions";
import { forgetPushSubscription } from "@/app/(app)/profile/settings/notification-actions";
import { useOfflineSignOut } from "@/components/offline/offline-queue-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Section } from "@/components/ui/section";
import { downloadJson } from "@/lib/download-json";
import { useT } from "@/lib/i18n/client";
import {
  deletePreviewLines,
  isDeleteWord,
  myDataFileName,
  runDelete,
} from "@/lib/my-data";
import { clearOfflineCaches, markPagesOwnerDeleted } from "@/lib/offline-pages";
import { browserSubscription, signOutCleanup } from "@/lib/push-support";
import { reach } from "@/lib/reach";
import { cn } from "@/lib/utils";
import { isolate } from "@/supabase/functions/_shared/i18n";

// Saves everything Keepup keeps about this person as keepup-my-data-{date}.json, then says which file.
// "Download started", not "Downloaded": an iPhone home-screen app can drop a download silently. Inline, not a toast: the button also sits in the delete dialog.
function ExportMyDataButton() {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-inner">
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full"
        disabled={pending}
        onClick={() => {
          setError(null);
          setSaved(null);
          startTransition(async () => {
            const r = await reach(exportMyData, { offline: t("myData.exportOffline"), reload: t("errors.generic") });
            if (!r.ok) return setError(r.message);
            const file = myDataFileName(new Date());
            downloadJson(file, r.data);
            setSaved(file);
          });
        }}
      >
        {pending ? t("common.exporting") : t("myData.export")}
      </Button>
      <p role="status" className={cn("text-sm font-semibold text-done", !saved && "sr-only")}>
        {saved ? t("common.downloaded", { file: isolate(saved) }) : ""}
      </p>
      {error && (
        <Notice tone="error" live>
          {error}
        </Notice>
      )}
    </div>
  );
}

// Settings → Your data (M6). Delete account works like Reset my data: typing "delete" guards the
// button. The dialog says which groups go with the account and who becomes admin where this person
// was the last one (public.delete_account_preview). Then lib/my-data.ts runDelete: waiting check-ins
// are sent, the phone is cleared the way sign-out clears it, and the account is deleted.
// A demo login has no Delete account at all (the demo deletes itself after 24 hours); Export stays.
export function MyData({ isDemo = false }: { isDemo?: boolean }) {
  const { t } = useT();
  return (
    <Section title={t("myData.title")}>
      <p className="text-sm text-muted-foreground">{t("myData.exportHint")}</p>
      <ExportMyDataButton />
      {!isDemo && <DeleteAccount />}
    </Section>
  );
}

function DeleteAccount() {
  const { t, rich, locale } = useT();
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [lines, setLines] = useState<ReactNode[] | null>(null);
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
    let next: { lines: ReactNode[] } | { error: string };
    try {
      const preview = await deleteAccountPreview();
      next = preview ? { lines: deletePreviewLines(rich, locale, preview) } : { error: t("errors.generic") };
    } catch {
      next = { error: navigator.onLine ? t("errors.generic") : t("offline.needsConnection") };
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
      setError(t("offline.needsConnection"));
      return;
    }
    startTransition(async () => {
      // A successful delete redirects to the landing page: runDelete passes that on, never DELETE_FAILED.
      const message = await runDelete(t, {
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
        {t("myData.deleteAccount")}
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && !next && close()}>
        <DialogContent>
          {/* pe-10: room for the dialog's close X. Title over description: line-height, no gap. */}
          <div className="flex flex-col pe-10">
            <DialogTitle>{t("myData.deleteTitle")}</DialogTitle>
            <DialogDescription>{t("myData.deleteBody")}</DialogDescription>
          </div>
          {lines && lines.length > 0 && (
            <ul className="flex flex-col gap-inner text-sm">
              {lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
          {previewError && (
            <Notice
              tone="error"
              live
              action={
                <Button type="button" variant="outline" className="-my-2 h-11 shrink-0" onClick={() => void loadPreview()}>
                  {t("common.tryAgain")}
                </Button>
              }
            >
              {previewError}
            </Notice>
          )}
          <p className="text-sm text-muted-foreground">{t("myData.exportFirst")}</p>
          <ExportMyDataButton />
          <form
            className="flex flex-col gap-item"
            onSubmit={(e) => {
              e.preventDefault();
              if (ready && isDeleteWord(t, word) && !pending) remove();
            }}
          >
            <div className="flex flex-col gap-inner">
              <label htmlFor={inputId} className="text-sm font-semibold">
                {t("settings.typeToConfirm", { word: t("myData.deleteWord") })}
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
            </div>
            {error && (
              <Notice tone="error" live>
                {error}
              </Notice>
            )}
            <div className="flex gap-inner">
              <Button type="button" variant="outline" className="h-11 flex-1" disabled={pending} onClick={close}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" variant="destructive" className="h-11 flex-1" disabled={pending || !ready || !isDeleteWord(t, word)}>
                {pending ? t("common.deleting") : t("common.delete")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
