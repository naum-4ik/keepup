"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

// "Try again" for a page whose data didn't load: reads the page again from the server (router.refresh),
// keeping scroll and client state, and says so while it does.
export function RefreshButton({ label, pendingLabel, className }: { label: string; pendingLabel: string; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())} className={cn(className)}>
      {pending ? pendingLabel : label}
    </button>
  );
}
