import { CloudOff } from "lucide-react";

export const dynamic = "force-static";

// What the service worker shows for a page that isn't saved on this phone (ideas/offline.md §3).
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-accent text-primary">
        <CloudOff aria-hidden className="size-6" />
      </div>
      <h1 className="text-xl font-bold">You&apos;re offline</h1>
      <p className="text-sm text-muted-foreground">
        This page needs a connection. Today and the kid view work offline, and check-ins you make there wait on this phone until
        you&apos;re back.
      </p>
      {/* A plain link, not next/link: a full page load is what the worker answers from its saved copy. */}
      <a href="/today" className="flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline">
        Open Today
      </a>
    </main>
  );
}
