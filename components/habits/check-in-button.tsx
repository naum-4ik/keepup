"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Check, Clock, Plus, Snowflake } from "lucide-react";
import { checkIn, checkInWith } from "@/app/(app)/habits/actions";
import { dismissFirstCheckinTip } from "@/components/first-checkin-tip";
import { useOfflineQueue, useSubmitTap } from "@/components/offline/offline-queue-provider";
import { GENERIC_ERROR } from "@/lib/habit-errors";
import { NEEDS_CONNECTION, SAVING } from "@/lib/offline-copy";
import { queueKey } from "@/lib/offline-queue";
import type { CheckInState } from "@/lib/schedule";
import { cn } from "@/lib/utils";

const LABEL: Record<CheckInState, string> = {
  open: "Check in",
  done: "Done",
  pending: "Waiting for approval",
  "checked-today": "Checked in today",
  frozen: "Paused",
  "not-started": "Starts later",
};

export function CheckInButton({
  habitId,
  title,
  state,
  multi,
  withChildren = [],
}: {
  habitId: string;
  title: string;
  state: CheckInState;
  multi: boolean;
  // "Me + Mary" (ideas/kids-and-groups.md §5): children in this group habit who still have it open.
  // Only ever offered on the viewer's own check-in.
  withChildren?: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  // Bumped on every successful check-in and used as the button's key, so a quick repeat tap on a
  // multi-count habit remounts the node and replays the bounce, even if the previous one is still playing.
  const [burst, setBurst] = useState(0);
  const celebrateTimeout = useRef<number | null>(null);
  const [choosing, setChoosing] = useState(false);
  const { queued } = useOfflineQueue();
  const submitTap = useSubmitTap();
  const savingId = useId();
  // A tap waiting on this phone (ideas/offline.md §1): it looks checked and says it's saving. While
  // the online try runs, the button's own busy state says enough.
  const saving = queued.has(queueKey(habitId));
  const savingShown = saving && !pending;
  const shown: CheckInState = saving && state === "open" && !multi ? "checked-today" : state;
  const Icon = shown === "frozen" ? Snowflake : shown === "not-started" || shown === "pending" ? Clock : shown === "open" && multi ? Plus : Check;

  function celebrate() {
    dismissFirstCheckinTip();
    // The check-in moment: a soft haptic tick where supported (Android; iPhone Safari has none)
    // and a short bounce. CSS drops the animation under prefers-reduced-motion.
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
    setBurst((b) => b + 1);
    setCelebrating(true);
    if (celebrateTimeout.current) window.clearTimeout(celebrateTimeout.current);
    celebrateTimeout.current = window.setTimeout(() => setCelebrating(false), 450);
  }

  function run(childIds: string[]) {
    setChoosing(false);
    startTransition(async () => {
      if (childIds.length > 0) {
        // "Me + Mary" stays online-only (owner decision).
        if (!navigator.onLine) {
          setError(NEEDS_CONNECTION);
          return;
        }
        try {
          const result = await checkInWith(habitId, childIds);
          if (!result.ok) setError(result.message);
          else celebrate();
        } catch {
          setError(navigator.onLine ? GENERIC_ERROR : NEEDS_CONNECTION);
        }
        return;
      }
      // Saved on this phone first, then tried online (offline it just waits): lib/offline-client.ts.
      const result = await submitTap({ habitId }, (tap) => checkIn(habitId, tap));
      if (!result.ok) {
        setError(result.message);
        return;
      }
      celebrate();
    });
  }

  useEffect(() => {
    return () => {
      if (celebrateTimeout.current) window.clearTimeout(celebrateTimeout.current);
    };
  }, []);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        key={burst}
        type="button"
        aria-label={`${LABEL[shown]}: ${title}`}
        aria-describedby={savingShown ? savingId : undefined}
        // Disabled while the request runs, so a double tap sends one check-in.
        disabled={shown !== "open" || pending}
        aria-expanded={withChildren.length > 0 && shown === "open" ? choosing : undefined}
        onClick={() => {
          setError(null);
          if (withChildren.length > 0) setChoosing((c) => !c);
          else run([]);
        }}
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          shown === "done" && "border-done bg-done text-done-foreground",
          celebrating && "animate-checkin",
          // Finishing check-in: the target was just reached.
          celebrating && shown === "done" && "motion-safe:shadow-[0_0_0_6px_color-mix(in_srgb,var(--done)_18%,transparent)]",
          shown === "pending" && "border-pending text-pending",
          shown === "checked-today" && "border-done text-done",
          shown === "frozen" && "border-border text-frozen",
          shown === "not-started" && "border-border text-muted-foreground",
          shown === "open" && "border-input text-primary hover:bg-accent",
          pending && "opacity-60",
        )}
      >
        <Icon className="size-5" strokeWidth={2.5} aria-hidden />
      </button>
      {choosing && shown === "open" && (
        <div
          role="group"
          aria-label={`Who did ${title}?`}
          className="flex max-w-56 flex-wrap justify-end gap-1.5"
          onKeyDown={(e) => e.key === "Escape" && setChoosing(false)}
        >
          <ChoiceButton onClick={() => run([])}>Just me</ChoiceButton>
          {withChildren.map((c) => (
            <ChoiceButton key={c.id} onClick={() => run([c.id])}>
              Me + {c.name}
            </ChoiceButton>
          ))}
          {withChildren.length > 1 && <ChoiceButton onClick={() => run(withChildren.map((c) => c.id))}>Me + everyone</ChoiceButton>}
        </div>
      )}
      {error && (
        <p role="alert" className="max-w-40 text-right text-xs text-destructive">
          {error}
        </p>
      )}
      {savingShown && (
        <p id={savingId} className="text-xs text-muted-foreground">
          {SAVING}
        </p>
      )}
    </div>
  );
}

function ChoiceButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 items-center rounded-full border-2 border-input bg-card px-3.5 text-sm font-semibold text-primary hover:bg-accent"
    >
      {children}
    </button>
  );
}
