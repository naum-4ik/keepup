"use client";

import { useEffect, useState } from "react";
import { DRIFT_EVERY, drifterFor, FIRST_DRIFT, nextDelay, SPARKLE_EVERY } from "@/lib/kid-idle";
import type { SceneItem } from "@/lib/scene-items";
import { usePageVisible, useReducedMotion } from "@/components/kids/use-calm";

type Sparkle = { key: number; item: number | null };

// The scene's idle extras (lib/kid-idle.ts): now and then something drifts across the sky, and a sparkle
// fades in and out on a random item. Timers run only while the tab is visible, motion is allowed and
// nothing else plays (`paused`); under Reduce Motion nothing is drawn. Decorative only.
export function SceneIdle({ items, theme, paused }: { items: SceneItem[]; theme: string; paused: boolean }) {
  const reduce = useReducedMotion();
  const visible = usePageVisible();
  const active = !reduce && visible && !paused;
  const [drift, setDrift] = useState<number | null>(null);
  const [sparkle, setSparkle] = useState<Sparkle | null>(null);
  const count = items.length;

  useEffect(() => {
    if (!active) return;
    let driftTimer = window.setTimeout(function drifted() {
      setDrift(Date.now());
      driftTimer = window.setTimeout(drifted, nextDelay(DRIFT_EVERY));
    }, nextDelay(FIRST_DRIFT));
    let sparkleTimer = window.setTimeout(function sparkled() {
      // On a random item; on the stage picture while the scene is still empty.
      setSparkle({ key: Date.now(), item: count === 0 ? null : Math.floor(Math.random() * count) });
      sparkleTimer = window.setTimeout(sparkled, nextDelay(SPARKLE_EVERY));
    }, nextDelay(SPARKLE_EVERY));
    return () => {
      window.clearTimeout(driftTimer);
      window.clearTimeout(sparkleTimer);
    };
  }, [active, count]);

  if (reduce) return null;
  const spot = sparkle ? spotFor(sparkle.item === null ? undefined : items[sparkle.item]) : null;
  // Inline, so it wins over the animation shorthand.
  const still = { animationPlayState: paused ? "paused" : "running" } as const;
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {drift !== null && (
        <span
          key={drift}
          data-idle="drift"
          className="absolute inset-x-0 top-[12%] z-[5] block animate-idle-drift opacity-0"
          style={still}
          onAnimationEnd={() => setDrift((d) => (d === drift ? null : d))}
        >
          <span className="block w-fit text-4xl leading-none select-none">{drifterFor(theme)}</span>
        </span>
      )}
      {sparkle && spot && (
        <span
          key={sparkle.key}
          data-idle="sparkle"
          className="absolute z-[200] -translate-x-1/2 -translate-y-1/2 text-2xl leading-none select-none"
          style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
        >
          <span className="block animate-idle-sparkle opacity-0" style={still} onAnimationEnd={() => setSparkle((s) => (s?.key === sparkle.key ? null : s))}>
            ✨
          </span>
        </span>
      )}
    </span>
  );
}

// A little above and to the right of the item (standing things touch the ground at y); on the stage
// picture while the scene is still empty.
function spotFor(item: SceneItem | undefined): { x: number; y: number } {
  if (!item) return { x: 56, y: 40 };
  return { x: item.x + 4, y: item.y - (item.standing ? 12 * item.scale : 6) };
}
