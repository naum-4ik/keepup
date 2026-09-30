"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const HOLD_MS = 1500;

// Leaving the kid view takes a 1.5s press-and-hold, so a child's taps don't close it. A ring fills
// while held (motion-safe); with reduced motion the text counts instead. Releasing early cancels.
// Space/Enter held down work the same. (A parent PIN comes later, per the spec.)
export function HoldToExit({ href, childName }: { href: string; childName: string }) {
  const router = useRouter();
  const [holding, setHolding] = useState(false);
  const [step, setStep] = useState(0);
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const cancel = () => {
    clear();
    setHolding(false);
    setStep(0);
  };
  const start = () => {
    if (timers.current.length > 0) return;
    setHolding(true);
    setStep(0);
    timers.current = [
      window.setTimeout(() => setStep(1), HOLD_MS / 3),
      window.setTimeout(() => setStep(2), (HOLD_MS * 2) / 3),
      window.setTimeout(() => {
        timers.current = [];
        router.push(href);
      }, HOLD_MS),
    ];
  };

  useEffect(() => () => clear(), []);

  return (
    <button
      type="button"
      aria-label={`Hold to exit ${childName}'s view`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start();
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
      // Focus moving away (another tap elsewhere, the app going to the background) ends the hold.
      onBlur={cancel}
      onKeyDown={(e) => {
        if (e.key !== " " && e.key !== "Enter") return;
        e.preventDefault();
        if (!e.repeat) start();
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") cancel();
      }}
      // A quick tap does nothing.
      onClick={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      className="relative flex h-11 touch-none items-center gap-2 rounded-full bg-card px-3 text-sm font-semibold text-muted-foreground shadow-soft select-none [-webkit-touch-callout:none]"
    >
      <svg aria-hidden viewBox="0 0 36 36" className="size-6 -rotate-90">
        <circle cx="18" cy="18" r="15.9" pathLength={100} fill="none" strokeWidth="4" className="stroke-muted" />
        {holding && (
          <circle
            cx="18"
            cy="18"
            r="15.9"
            pathLength={100}
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="100"
            strokeDashoffset="100"
            className="stroke-primary motion-safe:animate-hold-ring motion-reduce:hidden"
          />
        )}
      </svg>
      <span aria-live="polite">
        {!holding ? (
          "Hold to exit"
        ) : (
          <>
            <span className="motion-safe:hidden">{["Hold…", "Hold… 1…", "Hold… 1… 2"][step]}</span>
            <span className="motion-reduce:hidden">Hold…</span>
          </>
        )}
      </span>
    </button>
  );
}
