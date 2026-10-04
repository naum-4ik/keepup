// components/sign-out-button.tsx
"use client";

import { useTransition } from "react";
import { signOut } from "@/app/auth/actions";
import { forgetPushSubscription } from "@/app/(app)/profile/settings/notification-actions";
import { useOfflineSignOut } from "@/components/offline/offline-queue-provider";
import { Button } from "@/components/ui/button";
import { clearOfflineCaches } from "@/lib/offline-pages";
import { browserSubscription, signOutCleanup } from "@/lib/push-support";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();
  const queue = useOfflineSignOut();
  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-full"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await signOutCleanup({
            getSubscription: browserSubscription,
            forget: async (endpoint) => void (await forgetPushSubscription(endpoint)),
            clearCaches: clearOfflineCaches,
            flushQueue: queue.flushQueue,
            deleteQueue: queue.deleteQueue,
          });
          await signOut();
        })
      }
    >
      Sign out
    </Button>
  );
}
