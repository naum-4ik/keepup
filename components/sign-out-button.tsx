// components/sign-out-button.tsx
"use client";

import { useRef, useState, useTransition } from "react";
import { signOut } from "@/app/auth/actions";
import { forgetPushSubscription } from "@/app/(app)/profile/settings/notification-actions";
import { useOfflineSignOut } from "@/components/offline/offline-queue-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { unsavedSignOut } from "@/lib/offline-copy";
import { clearOfflineCaches } from "@/lib/offline-pages";
import { browserSubscription, signOutCleanup, signOutWithQueue } from "@/lib/push-support";
import { useT } from "@/lib/i18n/client";

export function SignOutButton() {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const queue = useOfflineSignOut();
  // Check-ins still on the phone after the last send: the confirm is open while this is set.
  const [unsaved, setUnsaved] = useState<number | null>(null);
  const answer = useRef<((dropThem: boolean) => void) | null>(null);

  const reply = (dropThem: boolean) => {
    answer.current?.(dropThem);
    answer.current = null;
    setUnsaved(null);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await signOutWithQueue({
              flushQueue: queue.flushQueue,
              pendingCount: queue.pendingCount,
              confirmDrop: (count) =>
                new Promise<boolean>((resolve) => {
                  answer.current = resolve;
                  setUnsaved(count);
                }),
              cleanup: () =>
                signOutCleanup({
                  getSubscription: browserSubscription,
                  forget: async (endpoint) => void (await forgetPushSubscription(endpoint)),
                  clearCaches: clearOfflineCaches,
                  deleteQueue: queue.deleteQueue,
                }),
              signOut,
            });
          })
        }
      >
        {t("common.signOut")}
      </Button>
      <Dialog open={unsaved !== null} onOpenChange={(open) => !open && reply(false)}>
        <DialogContent>
          <div className="flex flex-col gap-1 pr-10">
            <DialogTitle>{t("common.signOutTitle")}</DialogTitle>
            <DialogDescription>{unsaved !== null && unsavedSignOut(t, unsaved)}</DialogDescription>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => reply(false)}>
              {t("offline.staySignedIn")}
            </Button>
            <Button type="button" variant="destructive" className="h-11 flex-1" onClick={() => reply(true)}>
              {t("offline.signOutAnyway")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
