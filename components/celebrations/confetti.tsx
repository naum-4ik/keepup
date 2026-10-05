import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

// The category colours (lib/categories.ts icon colours).
const COLORS = ["#3B82B8", "#4F8A5B", "#7B61B0", "#B08A1E", "#C2505F", "#3A8C7E", "#8A6B45", "#8A7F76"];

// Deterministic spread (no Math.random), so the server and client render the same pieces: up and
// out in a fan, a little uneven. Each keeps its final (faded) frame, so it plays once per mount.
const pieces = (count: number, reach: number) =>
  Array.from({ length: count }, (_, i) => {
    const angle = ((i / count) * 2 * Math.PI) + ((i * 7) % 5) * 0.08;
    const dist = (48 + ((i * 29) % 40)) * reach;
    return {
      color: COLORS[i % COLORS.length],
      dx: Math.round(Math.cos(angle) * dist * 1.6),
      dy: Math.round(-Math.abs(Math.sin(angle)) * dist - 16),
      rot: ((i * 83) % 360) + 180,
      delay: (i % 4) * 30,
    };
  });
const SMALL = pieces(24, 1);
// The kid view's all-done dance (ideas/kid-view-next.md, 2026-10-05): more pieces, flying further.
const BIG = pieces(40, 1.8);

// A small burst in the card, never full-screen (docs/design.md); `big` still stays in its box.
// Hidden under reduced motion.
export function Confetti({ big = false }: { big?: boolean }) {
  return (
    <span aria-hidden data-confetti={big ? "big" : "small"} className="pointer-events-none absolute inset-0 motion-reduce:hidden">
      {(big ? BIG : SMALL).map((p, i) => (
        <span
          key={i}
          className={cn("absolute top-1/2 left-1/2 animate-confetti rounded-[1px] opacity-0", big ? "size-2.5" : "size-1.5")}
          style={
            {
              backgroundColor: p.color,
              animationDelay: `${p.delay}ms`,
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              "--rot": `${p.rot}deg`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
