"use client";

import { CloudOff, X } from "lucide-react";
import { useOfflineNotice } from "@/components/offline/offline-queue-provider";
import { useOnline } from "@/components/offline/use-online";
import { COULDNT_SAVE, OFFLINE_BANNER } from "@/lib/offline-copy";
import { cn } from "@/lib/utils";

// Offline, Today and the kid view are the copies saved on this phone (ideas/offline.md §3). Online, it
// says when a queued check-in had to be given up. The status region is always there (screen readers
// announce a change of its text, not a region that appears).
// "header": inside the app header, sticky with it. "bottom" (the kid view): the picture owns the top there.
export function OfflineBanner({ placement }: { placement: "header" | "bottom" }) {
  const online = useOnline();
  const { notice, dismiss } = useOfflineNotice();
  const text = !online ? OFFLINE_BANNER : notice ? COULDNT_SAVE : null;
  return (
    <div role="status">
      {text && (
        <>
          {placement === "bottom" && (
            // Room at the end of the page, so the last card can scroll clear of the fixed banner.
            <div aria-hidden className="h-[calc(2.25rem+max(env(safe-area-inset-bottom),0.5rem))]" />
          )}
          <p
            className={cn(
              "flex items-center justify-center gap-2 bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground",
              placement === "header"
                ? "mx-auto mt-2 w-[calc(100%-2rem)] max-w-[calc(28rem-2rem)] rounded-xl"
                : "fixed inset-x-0 bottom-0 z-40 pb-[max(env(safe-area-inset-bottom),0.5rem)]",
            )}
          >
            {!online && <CloudOff aria-hidden className="size-4 shrink-0" />}
            <span>{text}</span>
            {online && (
              <button type="button" onClick={dismiss} aria-label="Dismiss" className="-my-2 flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-background/60">
                <X aria-hidden className="size-4" />
              </button>
            )}
          </p>
        </>
      )}
    </div>
  );
}
