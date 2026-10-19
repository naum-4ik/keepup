"use client";

import { unstable_rethrow } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Check, Clock, LoaderCircle, Plus, Snowflake, Undo2 } from "lucide-react";
import { undoForChild } from "@/app/(app)/kids/actions";
import { useOfflineQueue, useSubmitTap } from "@/components/offline/offline-queue-provider";
import { queueKey } from "@/lib/offline-queue";
import { reach } from "@/lib/reach";
import type { CheckInState } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import { isolate } from "@/supabase/functions/_shared/i18n";

// The select keys of kids.checkIn.label.
const STATE_KEY: Record<CheckInState, string> = {
  open: "open",
  done: "done",
  pending: "pending",
  "checked-today": "checkedToday",
  frozen: "frozen",
  "not-started": "notStarted",
};

// An adult checks in for a child (Today's kid section, the kid page). On success a ⭐ bounces next
// to the button (motion-safe only; with reduced motion it just appears). Offline, the tap waits on
// this phone with "Saving…" (ideas/offline.md, "taps in the car").
export function KidCheckInButton({
  habitId,
  title,
  childId,
  childName,
  state,
  multi,
}: {
  habitId: string;
  title: string;
  childId: string;
  childName: string;
  state: CheckInState;
  multi: boolean;
}) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [star, setStar] = useState(0);
  const timer = useRef<number | null>(null);
  const { queued, delta } = useOfflineQueue();
  const submitTap = useSubmitTap();
  const savingId = useId();
  const saving = queued.has(queueKey(habitId, childId));
  const savingShown = saving && !pending;
  // delta: a waiting tap the page doesn't count yet (+), or a waiting undo of one it does (-).
  const change = delta.get(queueKey(habitId, childId)) ?? 0;
  const shown: CheckInState =
    !multi && change > 0 && state === "open" ? "checked-today" : !multi && change < 0 && (state === "done" || state === "checked-today") ? "open" : state;
  const Icon = shown === "frozen" ? Snowflake : shown === "not-started" || shown === "pending" ? Clock : shown === "open" && multi ? Plus : Check;

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  return (
    <div className="flex flex-col items-end gap-inner">
      <div className="relative">
        <button
          type="button"
          aria-label={
            pending
              ? t("kids.checkIn.checking", { name: isolate(childName), title: isolate(title) })
              : t("kids.checkIn.label", { state: STATE_KEY[shown], name: isolate(childName), title: isolate(title) })
          }
          aria-describedby={savingShown ? savingId : undefined}
          disabled={shown !== "open" || pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const celebrate = () => {
                if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
                setStar((n) => n + 1);
                if (timer.current) window.clearTimeout(timer.current);
                timer.current = window.setTimeout(() => setStar(0), 1200);
              };
              // Saved on this phone first, then tried online (offline it just waits): lib/offline-client.ts.
              const result = await submitTap({ habitId, subjectId: childId });
              if (!result.ok) {
                setError(result.message);
                return;
              }
              celebrate();
            });
          }}
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            shown === "done" && "border-done bg-done text-done-foreground",
            shown === "pending" && "border-pending text-pending",
            shown === "checked-today" && "border-done text-done",
            shown === "frozen" && "border-border text-frozen",
            shown === "not-started" && "border-border text-muted-foreground",
            shown === "open" && "border-input text-primary hover:bg-accent",
            pending && "opacity-60",
          )}
        >
          {pending ? (
            // In progress: the label says "Checking in…", and the icon spins (held still under reduced motion).
            <LoaderCircle className="size-5 motion-safe:animate-spin" strokeWidth={2.5} aria-hidden />
          ) : (
            <Icon className="size-5" strokeWidth={2.5} aria-hidden />
          )}
        </button>
        {star > 0 && (
          <span key={star} aria-hidden className="pointer-events-none absolute -top-3 -start-3 text-xl leading-none motion-safe:animate-star">
            ⭐
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="max-w-40 text-end text-xs text-destructive">
          {error}
        </p>
      )}
      {savingShown && (
        <p id={savingId} className="text-xs text-muted-foreground">
          {t("offline.saving")}
        </p>
      )}
    </div>
  );
}

// Any adult of the group may undo a child's check-in while its period is open. While it undoes, the
// button says "Undoing…" (its name, "Undoing Tidy my toys…"); the row then leaves with the refresh.
export function UndoForChildButton({
  checkInId,
  habitId,
  childId,
  label,
  title,
}: {
  checkInId: string;
  habitId: string;
  childId: string;
  label: string;
  title: string;
}) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex flex-col items-end gap-inner">
      <button
        type="button"
        aria-label={pending ? t("kids.checkIn.undoingLabel", { title: isolate(title) }) : label}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await reach(() => undoForChild(checkInId, habitId, childId), { offline: t("kids.errors.offline"), reload: t("kids.errors.reload") }, { rethrow: unstable_rethrow });
            setError(r.ok ? null : r.message);
          })
        }
        // Icon to label: one glyph pair, 4 px. 12 px sides: the pill's radius.
        className="flex h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
      >
        {pending ? <LoaderCircle aria-hidden className="size-4 motion-safe:animate-spin" /> : <Undo2 aria-hidden className="size-4" />}
        {pending ? t("kids.checkIn.undoing") : t("offline.undo")}
      </button>
      {error && (
        <span role="alert" className="max-w-40 pe-3 text-end text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
