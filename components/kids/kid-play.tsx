"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { checkInFor } from "@/app/(app)/kids/actions";
import { Avatar } from "@/components/avatar";
import { GardenPicture, NextStep } from "@/components/kids/garden";
import { HoldToExit } from "@/components/kids/hold-to-exit";
import type { CheckInState } from "@/lib/schedule";
import { cn } from "@/lib/utils";

type PlayHabit = { id: string; title: string; emoji: string; target: number; done: number; state: CheckInState };
type Child = { id: string; name: string; emoji: string | null; color: string | null; theme: string };
type Flying = { key: number; x: number; y: number; dx: number; dy: number };

// The full-screen kid view: big buttons, a tap counts at once (logged as by the child), a ⭐ flies
// to the garden and the count bumps. No numbers besides stars; no XP.
export function KidPlay({ child, habits, stars }: { child: Child; habits: PlayHabit[]; stars: number }) {
  const [pending, startTransition] = useTransition();
  const [view, tap] = useOptimistic({ habits, stars }, (s, habitId: string) => ({
    stars: s.stars + 1,
    habits: s.habits.map((h) => {
      if (h.id !== habitId) return h;
      const done = h.done + 1;
      return { ...h, done, state: (done >= h.target ? "done" : "open") as CheckInState };
    }),
  }));
  const [error, setError] = useState<string | null>(null);
  const [flying, setFlying] = useState<Flying[]>([]);
  const garden = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  const fly = (from: HTMLElement) => {
    const a = from.getBoundingClientRect();
    const b = garden.current?.getBoundingClientRect();
    const x = a.left + a.width / 2;
    const y = a.top + a.height / 2;
    const key = ++seq.current;
    const star = { key, x, y, dx: b ? b.left + b.width / 2 - x : 0, dy: b ? b.top + b.height / 2 - y : -240 };
    setFlying((f) => [...f, star]);
    window.setTimeout(() => setFlying((f) => f.filter((s) => s.key !== key)), 800);
  };

  return (
    <div className="flex flex-1 flex-col gap-5">
      <header className="flex items-center gap-3">
        <Avatar name={child.name} emoji={child.emoji} color={child.color} size="lg" />
        <h1 className="min-w-0 flex-1 truncate text-2xl font-bold">{child.name}</h1>
        <HoldToExit href={`/kids/${child.id}`} childName={child.name} />
      </header>

      <div ref={garden} className="flex flex-col items-center gap-2">
        <GardenPicture stars={view.stars} size="lg" theme={child.theme} />
        <p className="text-3xl font-bold tabular-nums" aria-live="polite">⭐ {view.stars}</p>
        <NextStep stars={view.stars} theme={child.theme} />
      </div>

      {error && <p role="alert" className="text-center text-base text-destructive">{error}</p>}

      <ul className="grid grid-cols-1 gap-3 pb-4">
        {view.habits.map((h) => {
          const done = h.state !== "open";
          return (
            <li key={h.id}>
              <button
                type="button"
                disabled={done || pending}
                onClick={(e) => {
                  const el = e.currentTarget;
                  setError(null);
                  startTransition(async () => {
                    tap(h.id);
                    fly(el);
                    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
                    const r = await checkInFor(h.id, child.id, true);
                    if (!r.ok) setError(r.message);
                  });
                }}
                className={cn(
                  "flex min-h-24 w-full items-center gap-4 rounded-3xl border-2 p-4 text-left shadow-soft transition-colors",
                  done ? "border-[#4F8A5B] bg-[#4F8A5B] text-white" : "border-transparent bg-card active:bg-accent",
                )}
              >
                <span aria-hidden className={cn("flex size-16 shrink-0 items-center justify-center rounded-full text-5xl leading-none", done ? "bg-white/20" : "bg-accent")}>
                  {h.emoji}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="text-xl font-bold leading-tight">{h.title}</span>
                  {h.target > 1 && (
                    <span aria-hidden className="flex gap-1.5">
                      {Array.from({ length: h.target }, (_, i) => (
                        <span key={i} className={cn("size-3 rounded-full", i < h.done ? (done ? "bg-white" : "bg-[#4F8A5B]") : done ? "bg-white/40" : "bg-muted ring-1 ring-border")} />
                      ))}
                    </span>
                  )}
                </span>
                {done && (
                  <>
                    <Check aria-hidden className="size-10 shrink-0" strokeWidth={3} />
                    <span className="sr-only">, done</span>
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {flying.map((s) => (
        <span
          key={s.key}
          aria-hidden
          className="pointer-events-none fixed z-50 flex size-10 items-center justify-center text-4xl leading-none motion-safe:animate-star-fly motion-reduce:hidden"
          // Centred by offset, not translate: the animation owns the transform.
          style={{ left: s.x - 20, top: s.y - 20, ["--fly-x" as string]: `${s.dx}px`, ["--fly-y" as string]: `${s.dy}px` }}
        >
          ⭐
        </span>
      ))}
    </div>
  );
}
