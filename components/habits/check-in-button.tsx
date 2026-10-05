"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Check, Clock, Plus, Snowflake } from "lucide-react";
import { checkIn, checkInWith } from "@/app/(app)/habits/actions";
import { dismissFirstCheckinTip } from "@/components/first-checkin-tip";
import { floatXp, useXpFloat } from "@/components/habits/xp-float";
import { useOfflineQueue, useSubmitTap, useUndoQueuedTap } from "@/components/offline/offline-queue-provider";
import { GENERIC_ERROR } from "@/lib/habit-errors";
import { NEEDS_CONNECTION, SAVING, UNDO, undoLabel } from "@/lib/offline-copy";
import { queueKey } from "@/lib/offline-queue";
import { ringOf, type RingInput } from "@/lib/today";
import { ringDash } from "@/lib/week-overview";
import type { CheckInState } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { tapXp } from "@/lib/xp";

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
  progress = null,
  needsApproval = false,
}: {
  habitId: string;
  title: string;
  state: CheckInState;
  multi: boolean;
  // The habit's count: weekly/monthly partway (ringOf, taps waiting on this phone included) shows a
  // ring and "1/3" instead of the icon, while it can still take a tap or is checked for today.
  progress?: RingInput | null;
  // "Me + Mary" (ideas/kids-and-groups.md §5): children in this group habit who still have it open.
  // Only ever offered on the viewer's own check-in.
  withChildren?: { id: string; name: string }[];
  // The habit's check-ins wait for someone else's approval (habits.requires_approval): a tap waiting on
  // this phone floats no XP then (lib/xp.ts tapXp).
  needsApproval?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  // The "+10 XP" float of the latest check-in on this habit (components/habits/xp-float.ts).
  const xpFloat = useXpFloat(habitId);
  // Bumped on every successful check-in and used as the button's key, so a quick repeat tap on a
  // multi-count habit remounts the node and replays the bounce, even if the previous one is still playing.
  const [burst, setBurst] = useState(0);
  const celebrateTimeout = useRef<number | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [choosing, setChoosing] = useState(false);
  const { queued, delta } = useOfflineQueue();
  const submitTap = useSubmitTap();
  const undoQueued = useUndoQueuedTap();
  const savingId = useId();
  // A tap waiting on this phone (ideas/offline.md §1): it looks checked and says it's saving. While
  // the online try runs, the button's own busy state says enough.
  const saving = queued.has(queueKey(habitId));
  const savingShown = saving && !pending;
  // delta: a waiting tap the page doesn't count yet (+), or a waiting undo of one it does (-).
  const change = delta.get(queueKey(habitId)) ?? 0;
  const shown: CheckInState =
    !multi && change > 0 && state === "open" ? "checked-today" : !multi && change < 0 && (state === "done" || state === "checked-today") ? "open" : state;
  const Icon = shown === "frozen" ? Snowflake : shown === "not-started" || shown === "pending" ? Clock : shown === "open" && multi ? Plus : Check;
  const ring = progress ? ringOf(progress, change) : null;
  const shownRing = ring && (shown === "open" || shown === "checked-today") ? ring : null;

  function celebrate(earned = 0) {
    dismissFirstCheckinTip();
    // The check-in moment: a soft haptic tick where supported (Android; iPhone Safari has none)
    // and a short bounce. CSS drops the animation under prefers-reduced-motion.
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
    setBurst((b) => b + 1);
    setCelebrating(true);
    if (celebrateTimeout.current) window.clearTimeout(celebrateTimeout.current);
    celebrateTimeout.current = window.setTimeout(() => setCelebrating(false), 450);
    if (earned > 0) floatXp(habitId, earned);
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
      // "Me + Mary" above keeps celebrate(): several check-ins, no single number.
      celebrate(tapXp(result, needsApproval));
    });
  }

  useEffect(() => {
    return () => {
      if (celebrateTimeout.current) window.clearTimeout(celebrateTimeout.current);
    };
  }, []);

  return (
    <div className="relative flex flex-col items-end gap-1">
      <button
        key={burst}
        ref={buttonRef}
        type="button"
        aria-label={`${LABEL[shown]}: ${title}${shownRing ? `, ${shownRing.done} of ${shownRing.target}` : ""}`}
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
          // The ring is the outline.
          shownRing && "border-transparent",
          pending && "opacity-60",
        )}
      >
        {shownRing ? <Ring done={shownRing.done} target={shownRing.target} /> : <Icon className="size-5" strokeWidth={2.5} aria-hidden />}
      </button>
      {xpFloat && (
        // Decorative: the level on Profile says it in words. Hidden under reduced motion.
        <span aria-hidden data-xp-float key={xpFloat.id} className="pointer-events-none absolute -top-4 right-0 animate-xp-float text-xs font-bold whitespace-nowrap text-primary motion-reduce:hidden">
          +{xpFloat.xp} XP
        </span>
      )}
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
        <div className="flex items-center gap-1">
          <p id={savingId} className="text-xs text-muted-foreground">
            {SAVING}
          </p>
          {/* Takes the waiting tap back: it is never sent, and the card is open again. */}
          <button
            type="button"
            aria-label={undoLabel(title)}
            onClick={async () => {
              await undoQueued(habitId);
              // The Undo button goes away with the tap: focus goes back to the check-in button.
              requestAnimationFrame(() => buttonRef.current?.focus());
            }}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full px-2 text-xs font-semibold text-primary underline-offset-2 hover:underline"
          >
            {UNDO}
          </button>
        </div>
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

// "1/3" inside a ring filled to the share done. Decoration: the button's label says "1 of 3".
function Ring({ done, target }: { done: number; target: number }) {
  const r = 18;
  const { circumference, offset } = ringDash(done, target, r);
  return (
    <span aria-hidden className="relative flex size-full items-center justify-center">
      <svg viewBox="0 0 44 44" className="absolute inset-0 size-full -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="3" className="stroke-muted" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-current"
        />
      </svg>
      <span className="text-[0.6875rem] leading-none font-bold tabular-nums">
        {done}/{target}
      </span>
    </span>
  );
}
