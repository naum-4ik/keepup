"use client";

import { useEffect, useState } from "react";
import { playKidSound } from "@/lib/kid-sound";
import type { SceneItem } from "@/lib/scene-items";
import { cn } from "@/lib/utils";

// The week's items on the picture (lib/scene-items.ts). New ones spring up after the flying item from
// the tapped card lands; in the kid view each one wiggles when tapped, just for fun (it counts for
// nothing). `dancing`: everything done today.
export function SceneItems({
  items,
  size,
  interactive = false,
  dancing = false,
}: {
  items: SceneItem[];
  size: "md" | "lg";
  interactive?: boolean;
  dancing?: boolean;
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
          className="absolute"
          // Standing things touch the ground at y; floating ones are centred on it.
          style={{ left: `${item.x}%`, top: `${item.y}%`, transform: `translate(-50%, ${item.standing ? "-100%" : "-50%"}) scale(${item.scale})`, transformOrigin: item.standing ? "bottom" : "center", zIndex: Math.round(item.y) }}
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
              wiggling === i ? "animate-wiggle" : dancing ? "animate-dance" : i >= fresh && "animate-item-pop [animation-delay:600ms]",
            )}
            style={dancing ? { animationDelay: `${(i % 5) * 80}ms` } : undefined}
          >
            {item.emoji}
          </span>
        </span>
      ))}
    </span>
  );
}
