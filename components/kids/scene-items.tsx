"use client";

import { useEffect, useState } from "react";
import { playKidSound } from "@/lib/kid-sound";
import { idleMotion } from "@/lib/kid-idle";
import type { SceneItem } from "@/lib/scene-items";
import { cn } from "@/lib/utils";

// The week's items on the picture (lib/scene-items.ts). New ones spring up after the flying item from
// the tapped card lands; in the kid view each one wiggles when tapped, just for fun (it counts for
// nothing). `dancing`: everything done today. `idle` (kid view only): each item sways or bobs gently on
// its own, paused while a tap plays.
// The big reveal (KidPlay, lib/kid-reveal.ts): `hidden` items are still on their way (drawn invisible,
// so the flying copy can find its spot); `revealed` ones arrived that way and don't pop on their own;
// `landed` is the one that just arrived: its spot flashes (with Reduce Motion it fades in instead).
export type Idle = "play" | "pause";
export type Landed = { index: number; key: number };

export function SceneItems({
  items,
  size,
  interactive = false,
  dancing = false,
  idle,
  hidden,
  revealed,
  landed,
}: {
  items: SceneItem[];
  size: "md" | "lg";
  interactive?: boolean;
  dancing?: boolean;
  idle?: Idle;
  hidden?: ReadonlySet<number>;
  revealed?: ReadonlySet<number>;
  landed?: Landed | null;
}) {
  // Items there on the first render are drawn still; only ones added after it pop. Once a pop has
  // played (or after an undo), the current count becomes the new "seen" mark.
  const [seen, setSeen] = useState(items.length);
  const [wiggling, setWiggling] = useState<number | null>(null);
  const fresh = Math.min(seen, items.length);
  useEffect(() => {
    const t = window.setTimeout(() => setSeen(items.length), 1200);
    return () => window.clearTimeout(t);
  }, [items.length]);

  return (
    <span aria-hidden data-items={items.length} className={cn("absolute inset-0", !interactive && "pointer-events-none")}>
      {items.map((item, i) => (
        <span
          key={i}
          data-item={i}
          className={cn("absolute", hidden?.has(i) && "invisible")}
          // Standing things touch the ground at y; floating ones are centred on it.
          style={{ left: `${item.x}%`, top: `${item.y}%`, transform: `translate(-50%, ${item.standing ? "-100%" : "-50%"}) scale(${item.scale})`, transformOrigin: item.standing ? "bottom" : "center", zIndex: Math.round(item.y) }}
        >
          {/* Idle motion lives on its own wrapper, so it never fights the wiggle, dance or pop below. */}
          <span
            data-idle={idle ? "item" : undefined}
            className={cn(
              "block",
              idle && (idleMotion(i).kind === "sway" ? "animate-idle-sway" : "animate-idle-bob"),
              item.standing ? "origin-bottom" : "origin-center",
            )}
            style={idle ? { animationDuration: `${idleMotion(i).seconds}s`, animationDelay: `${idleMotion(i).delay}s`, animationPlayState: idle === "pause" ? "paused" : "running" } : undefined}
          >
            <span
              onPointerDown={
                interactive
                  ? () => {
                      setWiggling(i);
                      playKidSound("wiggle");
                    }
                  : undefined
              }
              onAnimationEnd={() => setWiggling((w) => (w === i ? null : w))}
              className={cn(
                "block leading-none select-none",
                size === "lg" ? "text-5xl" : "text-3xl",
                interactive && "cursor-pointer touch-manipulation",
                wiggling === i
                ? "animate-wiggle"
                : dancing
                  ? "animate-dance"
                  : landed?.index === i
                    ? "motion-reduce:animate-item-fade"
                    : i >= fresh && !revealed?.has(i) && "animate-item-pop [animation-delay:600ms]",
              )}
              style={dancing ? { animationDelay: `${(i % 5) * 80}ms` } : undefined}
            >
              {item.emoji}
            </span>
          </span>
          {landed?.index === i && (
            <span
              key={landed.key}
              data-flash
              className="pointer-events-none absolute inset-[-40%] -z-10 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.95)_0%,rgba(255,255,255,0.5)_40%,rgba(255,255,255,0)_70%)] opacity-0 motion-safe:animate-spot-flash"
            />
          )}
        </span>
      ))}
    </span>
  );
}
