"use client";

import { useOnline } from "@/components/offline/use-online";
import { useT } from "@/lib/i18n/client";

// Everything but check-ins needs the server (ideas/offline.md §3): shown, not usable, and it says why,
// naming the card (`label`) for screen readers, which skip the inert card itself.
export function NeedsConnection({ label, children }: { label: string; children: React.ReactNode }) {
  const { rich } = useT();
  const online = useOnline();
  if (online) return <>{children}</>;
  return (
    <div>
      <div inert className="opacity-50">{children}</div>
      <p className="mt-inner text-center text-xs font-semibold text-muted-foreground">
        {rich("offline.needsConnectionFor", { label, sr: (c: React.ReactNode) => <span className="sr-only">{c}</span> })}
      </p>
    </div>
  );
}
