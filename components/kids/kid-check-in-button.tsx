"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Clock, Plus, Snowflake, Undo2 } from "lucide-react";
import { checkInFor, undoForChild } from "@/app/(app)/kids/actions";
import type { CheckInState } from "@/lib/schedule";
import { cn } from "@/lib/utils";

const LABEL: Record<CheckInState, string> = {
  open: "Check in for",
  done: "Done for",
  pending: "Waiting for approval for",
  "checked-today": "Checked in today for",
  frozen: "Paused for",
  "not-started": "Starts later for",
};

// An adult checks in for a child (Today's kid section, the kid page). On success a ⭐ bounces next
// to the button (motion-safe only; with reduced motion it just appears).
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [star, setStar] = useState(0);
  const timer = useRef<number | null>(null);
  const Icon = state === "frozen" ? Snowflake : state === "not-started" || state === "pending" ? Clock : state === "open" && multi ? Plus : Check;

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="relative">
        <button
          type="button"
          aria-label={`${LABEL[state]} ${childName}: ${title}`}
          disabled={state !== "open" || pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await checkInFor(habitId, childId, false);
              if (!result.ok) {
                setError(result.message);
                return;
              }
              if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
              setStar((n) => n + 1);
              if (timer.current) window.clearTimeout(timer.current);
              timer.current = window.setTimeout(() => setStar(0), 1200);
            });
          }}
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            state === "done" && "border-done bg-done text-done-foreground",
            state === "pending" && "border-pending text-pending",
            state === "checked-today" && "border-done text-done",
            state === "frozen" && "border-border text-frozen",
            state === "not-started" && "border-border text-muted-foreground",
            state === "open" && "border-input text-primary hover:bg-accent",
            pending && "opacity-60",
          )}
        >
          <Icon className="size-5" strokeWidth={2.5} aria-hidden />
        </button>
        {star > 0 && (
          <span key={star} aria-hidden className="pointer-events-none absolute -top-3 -left-3 text-xl leading-none motion-safe:animate-star">
            ⭐
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="max-w-40 text-right text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// Any adult of the group may undo a child's check-in while its period is open.
export function UndoForChildButton({ checkInId, habitId, childId, label }: { checkInId: string; habitId: string; childId: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        aria-label={label}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await undoForChild(checkInId, habitId, childId);
            setError(r.ok ? null : r.message);
          })
        }
        className="flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
      >
        <Undo2 aria-hidden className="size-4" />
        Undo
      </button>
      {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
    </span>
  );
}
