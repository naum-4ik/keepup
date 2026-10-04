"use client";

import { CloudOff } from "lucide-react";
import { useOnline } from "@/components/offline/use-online";
import { cn } from "@/lib/utils";

// Offline, Today and the kid view are the copies saved on this phone (ideas/offline.md §3).
// "header": inside the app header, sticky with it. "bottom" (the kid view): the picture owns the top there.
export function OfflineBanner({ placement }: { placement: "header" | "bottom" }) {
  const online = useOnline();
  if (online) return null;
  const banner = (
    <p
      role="status"
      className={cn(
        "flex items-center justify-center gap-2 bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground",
        placement === "header"
          ? "mx-auto mt-2 w-[calc(100%-2rem)] max-w-[calc(28rem-2rem)] rounded-xl"
          : "fixed inset-x-0 bottom-0 z-40 pb-[max(env(safe-area-inset-bottom),0.5rem)]",
      )}
    >
      <CloudOff aria-hidden className="size-4" />
      Offline · showing your last update
    </p>
  );
  if (placement === "header") return banner;
  // Room at the end of the page, so the last card can scroll clear of the fixed banner.
  return (
    <>
      <div aria-hidden className="h-[calc(2.25rem+max(env(safe-area-inset-bottom),0.5rem))]" />
      {banner}
    </>
  );
}
