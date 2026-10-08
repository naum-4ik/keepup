"use client";

import { useOnline } from "@/components/offline/use-online";
import { NEEDS_CONNECTION } from "@/lib/offline-copy";

// Everything but check-ins needs the server (ideas/offline.md §3): shown, not usable, and it says why,
// naming the card (`label`) for screen readers, which skip the inert card itself.
export function NeedsConnection({ label, children }: { label: string; children: React.ReactNode }) {
  const online = useOnline();
  if (online) return <>{children}</>;
  return (
    <div>
      <div inert className="opacity-50">{children}</div>
      <p className="mt-1 text-center text-xs font-semibold text-muted-foreground">
        {NEEDS_CONNECTION}
        <span className="sr-only">: {label}</span>
      </p>
    </div>
  );
}
