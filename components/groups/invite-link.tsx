"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { createInvite, revokeInvites, type GroupActionState } from "@/app/(app)/groups/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const noSubscribe = () => () => {};
const canShare = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

// The URL and date are built on the server (origin, the viewer's time zone) so the first render matches.
export function InviteLink({
  groupId,
  groupName,
  url,
  validUntil,
  autoFocus = false,
}: {
  groupId: string;
  groupName: string;
  url: string | null;
  validUntil: string | null;
  autoFocus?: boolean;
}) {
  const share = useSyncExternalStore(noSubscribe, canShare, () => false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const run = (call: () => Promise<GroupActionState>) =>
    startTransition(async () => {
      const result = await call();
      setError(result.status === "error" ? result.message : null);
    });

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("Couldn't copy. Select the link and copy it.");
    }
  };

  if (!url) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">Anyone with the link can join {groupName} for 7 days.</p>
        <Button type="button" className="h-11" disabled={pending} autoFocus={autoFocus} onClick={() => run(() => createInvite(groupId))}>
          {pending ? "Creating…" : "Create invite link"}
        </Button>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Anyone with this link can join {groupName} for 7 days.</p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="invite-link" className="text-sm font-semibold">
          Invite link <span className="font-normal text-muted-foreground">· valid until {validUntil}</span>
        </label>
        <Input
          id="invite-link"
          aria-label="Invite link"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 rounded-xl px-3 text-sm"
        />
      </div>
      <div className="flex gap-2">
        {share && (
          <Button
            type="button"
            className="h-11 flex-1 gap-1.5"
            autoFocus={autoFocus}
            onClick={() => navigator.share({ title: `Join ${groupName} on Keepup`, url }).catch(() => {})}
          >
            <Share2 aria-hidden className="size-4" /> Share
          </Button>
        )}
        <Button
          type="button"
          variant={share ? "outline" : "default"}
          className="h-11 flex-1 gap-1.5"
          autoFocus={autoFocus && !share}
          onClick={copy}
        >
          {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          {copied ? "Copied" : "Copy link"}
        </Button>
        <span role="status" className="sr-only">{copied ? "Copied" : ""}</span>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => revokeInvites(groupId))}
        className="-ml-2 flex min-h-11 items-center self-start rounded-lg px-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        {pending ? "Turning off…" : "Turn off link"}
      </button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
