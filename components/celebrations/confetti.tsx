import type { CSSProperties } from "react";

// The category colours (lib/categories.ts icon colours).
const COLORS = ["#3B82B8", "#4F8A5B", "#7B61B0", "#B08A1E", "#C2505F", "#3A8C7E", "#8A6B45", "#8A7F76"];
const COUNT = 24;

// Deterministic spread (no Math.random), so the server and client render the same pieces: up and
// out in a fan, a little uneven. Each keeps its final (faded) frame, so it plays once per mount.
const PIECES = Array.from({ length: COUNT }, (_, i) => {
  const angle = ((i / COUNT) * 2 * Math.PI) + ((i * 7) % 5) * 0.08;
  const dist = 48 + ((i * 29) % 40);
  return {
    color: COLORS[i % COLORS.length],
    dx: Math.round(Math.cos(angle) * dist * 1.6),
    dy: Math.round(-Math.abs(Math.sin(angle)) * dist - 16),
    rot: ((i * 83) % 360) + 180,
    delay: (i % 4) * 30,
  };
});

// A small burst in the card, never full-screen (docs/design.md). Hidden under reduced motion.
export function Confetti() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 motion-reduce:hidden">
      {PIECES.map((p, i) => (
        <span
          key={i}
          className="absolute top-1/2 left-1/2 size-1.5 animate-confetti rounded-[1px] opacity-0"
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
