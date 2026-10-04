"use client";

import { useOnline } from "@/components/offline/use-online";

// Everything but check-ins needs the server (ideas/offline.md §3): shown, not usable, and it says why.
export function NeedsConnection({ children }: { children: React.ReactNode }) {
  const online = useOnline();
  if (online) return <>{children}</>;
  return (
    <div>
      <div inert className="opacity-50">{children}</div>
      <p className="mt-1 text-center text-xs font-semibold text-muted-foreground">Needs a connection</p>
    </div>
  );
}
