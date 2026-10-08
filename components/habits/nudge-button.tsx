"use client";

import { useState, useTransition } from "react";
import { DropdownMenu } from "radix-ui";
import { nudge } from "@/app/(app)/inbox/actions";
import { Button } from "@/components/ui/button";
import { NUDGE_KINDS } from "@/lib/feed-copy";
import { NEEDS_CONNECTION } from "@/lib/offline-copy";

// Three preset messages, no free text (ideas/notifications-tone.md). One per person, habit and day.
export function NudgeButton({ habitId, recipientId, name, sent }: { habitId: string; recipientId: string; name: string; sent: boolean }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(sent);
  // cannot_nudge: they checked in or are set for now; nothing more to send today.
  const [closed, setClosed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <Button type="button" variant="outline" className="h-11 rounded-full px-4" disabled>
        Nudged ✓<span className="sr-only"> {name}</span>
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button type="button" variant="outline" className="h-11 rounded-full px-4" disabled={pending || closed}>
            Nudge<span className="sr-only"> {name}</span>
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            aria-label={`Nudge ${name}`}
            className="z-50 min-w-52 rounded-2xl bg-card p-1.5 shadow-[0_4px_24px_rgb(61_44_34_/_0.16)]"
          >
            {NUDGE_KINDS.map((k) => (
              <DropdownMenu.Item
                key={k.kind}
                onSelect={() =>
                  startTransition(async () => {
                    setError(null);
                    // Offline, or the request never came back (a thrown action): it needs the server.
                    if (!navigator.onLine) return setError(NEEDS_CONNECTION);
                    try {
                      const r = await nudge(habitId, recipientId, k.kind);
                      if (r.ok || r.code === "already_nudged") setDone(true);
                      else if (r.code === "cannot_nudge") {
                        setClosed(true);
                        setError(r.message ?? null);
                      } else setError(r.message ?? null);
                    } catch {
                      setError(NEEDS_CONNECTION);
                    }
                  })
                }
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-semibold outline-none select-none data-highlighted:bg-muted"
              >
                <span className="text-lg">{k.emoji}</span> {k.label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {error && (
        <p role="alert" className="max-w-48 text-right text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
