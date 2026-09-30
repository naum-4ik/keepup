"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Clock, Plus, Snowflake } from "lucide-react";
import { checkIn } from "@/app/(app)/habits/actions";
import { dismissFirstCheckinTip } from "@/components/first-checkin-tip";
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
}: {
  habitId: string;
  title: string;
  state: CheckInState;
  multi: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  // Bumped on every successful check-in and used as the button's key, so a quick repeat tap on a
  // multi-count habit remounts the node and replays the bounce, even if the previous one is still playing.
  const [burst, setBurst] = useState(0);
  const celebrateTimeout = useRef<number | null>(null);
  const Icon = state === "frozen" ? Snowflake : state === "not-started" || state === "pending" ? Clock : state === "open" && multi ? Plus : Check;

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
        aria-label={`${LABEL[state]}: ${title}`}
        // Disabled while the request runs, so a double tap sends one check-in.
        disabled={state !== "open" || pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await checkIn(habitId);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            dismissFirstCheckinTip();
            // The check-in moment: a soft haptic tick where supported (Android; iPhone Safari has none)
            // and a short bounce. CSS drops the animation under prefers-reduced-motion.
            if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
            setBurst((b) => b + 1);
            setCelebrating(true);
            if (celebrateTimeout.current) window.clearTimeout(celebrateTimeout.current);
            celebrateTimeout.current = window.setTimeout(() => setCelebrating(false), 450);
          });
        }}
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          state === "done" && "border-[#4F8A5B] bg-[#4F8A5B] text-white",
          celebrating && "animate-checkin",
          // Finishing check-in: the target was just reached.
          celebrating && state === "done" && "motion-safe:shadow-[0_0_0_6px_rgb(79_138_91_/_0.18)]",
          state === "pending" && "border-[#D4A017] text-[#9A6A10]",
          state === "checked-today" && "border-[#4F8A5B] text-[#4F8A5B]",
          state === "frozen" && "border-border text-[#5B8DB8]",
          state === "not-started" && "border-border text-muted-foreground",
          state === "open" && "border-input text-primary hover:bg-accent",
          pending && "opacity-60",
        )}
      >
        <Icon className="size-5" strokeWidth={2.5} aria-hidden />
      </button>
      {error && (
        <p role="alert" className="max-w-40 text-right text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
