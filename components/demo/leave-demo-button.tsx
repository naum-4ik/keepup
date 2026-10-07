"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { unstable_rethrow } from "next/navigation";
import { leaveDemo } from "@/app/demo/actions";
import { forgetPushSubscription } from "@/app/(app)/profile/settings/notification-actions";
import { useOfflineSignOut } from "@/components/offline/offline-queue-provider";
import { DEMO_SIGN_IN } from "@/lib/demo-copy";
import { GENERIC_ERROR } from "@/lib/habit-errors";
import { clearOfflineCaches, markPagesOwnerDeleted } from "@/lib/offline-pages";
import { browserSubscription, signOutCleanup } from "@/lib/push-support";
import { runLeaveDemo } from "@/lib/try-demo";

// The demo banner's "Sign in": the phone is cleared the way Delete account clears it, then leaveDemo
// ends the session and opens /login (lib/try-demo.ts runLeaveDemo).
export function LeaveDemoButton() {
  const queue = useOfflineSignOut();
  const [failed, setFailed] = useState(false);

  async function leave() {
    setFailed(false);
    const result = await runLeaveDemo({
      clearPhone: async () => {
        await signOutCleanup({
          getSubscription: browserSubscription,
          forget: async (endpoint) => void (await forgetPushSubscription(endpoint)),
          clearCaches: clearOfflineCaches,
          deleteQueue: queue.deleteQueue,
        });
        markPagesOwnerDeleted();
      },
      leave: leaveDemo,
      rethrow: unstable_rethrow,
    });
    if (result === "failed") setFailed(true);
  }

  return (
    <form action={leave} className="inline">
      <Submit />
      {failed && <span role="alert" className="block text-destructive">{GENERIC_ERROR}</span>}
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center px-1 font-bold text-foreground underline underline-offset-2 disabled:opacity-60">
      {DEMO_SIGN_IN}
    </button>
  );
}
