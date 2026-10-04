// components/sign-out-button.tsx
"use client";

import { useTransition } from "react";
import { signOut } from "@/app/auth/actions";
import { forgetPushSubscription } from "@/app/(app)/profile/settings/notification-actions";
import { Button } from "@/components/ui/button";
import { clearOfflineCaches } from "@/lib/offline-pages";
import { browserSubscription, signOutCleanup } from "@/lib/push-support";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();
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
          });
          await signOut();
        })
      }
    >
      Sign out
    </Button>
  );
}
