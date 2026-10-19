"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { createInvite, revokeInvites, type GroupActionState } from "@/app/(app)/groups/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { focusIsLost } from "@/lib/toast";
import { isolate } from "@/supabase/functions/_shared/i18n";

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
  const t = useTranslations("groups.invite");
  const tc = useTranslations("common");
  const bdi = (c: ReactNode) => <bdi>{c}</bdi>;
  const share = useSyncExternalStore(noSubscribe, canShare, () => false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // What the last create / turn off did: announced, and "turned off" also shown (the link just goes).
  const [done, setDone] = useState<"created" | "turnedOff" | null>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const createRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  // The button the person tapped goes away with the answer, so focus moves to what replaced it
  // (the link, or Create again), only when it was lost (lib/toast.ts focusIsLost).
  useEffect(() => {
    if (!done || !focusIsLost(document.activeElement, document.body)) return;
    (done === "created" ? linkRef : createRef).current?.focus();
  }, [done, url]);

  // Create "Creating…" / turn off "Turning off…"; offline or a request that died says what to do.
  const run = (call: () => Promise<GroupActionState>, next: "created" | "turnedOff") =>
    startTransition(async () => {
      setDone(null);
      let result: GroupActionState;
      try {
        result = navigator.onLine ? await call() : { status: "error", message: t("failed") };
      } catch {
        result = { status: "error", message: t("failed") };
      }
      setError(result.status === "error" ? result.message : null);
      if (result.status !== "error") setDone(next);
    });

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError(t("copyFailed"));
    }
  };

  // One live region, mounted across both branches (the branch swaps when the link comes or goes, and
  // a region that mounts with its text in it isn't announced reliably).
  const status = (
    <span role="status" className="sr-only">
      {done === "created" ? t("createdStatus") : done === "turnedOff" ? t("turnedOffStatus") : ""}
    </span>
  );

  if (!url) {
    return (
      <div className="flex flex-col gap-item">
        {status}
        {done === "turnedOff" && <Notice tone="success">{t("turnedOffStatus")}</Notice>}
        <p className="text-sm text-muted-foreground">{t.rich("helpNone", { group: groupName, bdi })}</p>
        <Button ref={createRef} type="button" className="h-11" disabled={pending} autoFocus={autoFocus} onClick={() => run(() => createInvite(groupId), "created")}>
          {pending ? tc("creating") : t("create")}
        </Button>
        {error && (
          <Notice tone="error" live>
            {error}
          </Notice>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-item">
      {/* The new link is on screen; a screen reader hears it was made. */}
      {status}
      <p className="text-sm text-muted-foreground">{t.rich("helpActive", { group: groupName, bdi })}</p>
      <div className="flex flex-col gap-inner">
        <label htmlFor="invite-link" className="text-sm font-semibold">
          {t.rich("label", { date: validUntil ?? "", muted: (c) => <span className="font-normal text-muted-foreground">{c}</span> })}
        </label>
        <Input
          ref={linkRef}
          id="invite-link"
          dir="ltr"
          aria-label={t("linkAria")}
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          // 12 px sides to match the 12 px radius (as Notice does); 16 px text, so iOS doesn't zoom in.
          className="h-11 rounded-xl px-3 text-base"
        />
      </div>
      <div className="flex gap-inner">
        {share && (
          <Button
            type="button"
            className="h-11 flex-1 gap-inner"
            autoFocus={autoFocus}
            onClick={() => navigator.share({ title: t("shareTitle", { group: isolate(groupName) }), url }).catch(() => {})}
          >
            <Share2 aria-hidden className="size-4" /> {t("share")}
          </Button>
        )}
        <Button
          type="button"
          variant={share ? "outline" : "default"}
          className="h-11 flex-1 gap-inner"
          autoFocus={autoFocus && !share}
          onClick={copy}
        >
          {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          {copied ? t("copied") : t("copy")}
        </Button>
        <span role="status" className="sr-only">{copied ? t("copied") : ""}</span>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => revokeInvites(groupId), "turnedOff")}
        className="-ms-inner flex min-h-11 items-center self-start rounded-lg px-inner text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        {pending ? t("turningOff") : t("turnOff")}
      </button>
      {error && (
        <Notice tone="error" live>
          {error}
        </Notice>
      )}
    </div>
  );
}
