import { levelLine, levelProgress } from "@/lib/levels";

// Profile: "Level 7 · Sprout" with a bar to the next level (ideas/achievements-and-rewards.md §3).
// Adults only: the kid view never shows XP.
export function LevelCard({ xp }: { xp: number }) {
  const p = levelProgress(xp);
  const line = levelLine(xp);
  return (
    <section aria-labelledby="level-title" className="flex flex-col gap-2 rounded-2xl bg-card p-5 shadow-soft">
      <h2 id="level-title" className="text-base font-bold">{line.title}</h2>
      <div
        role="progressbar"
        aria-label={`XP to Level ${p.level + 1}`}
        aria-valuemin={0}
        aria-valuemax={p.span}
        aria-valuenow={p.into}
        className="h-2.5 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${Math.round((p.into / p.span) * 100)}%` }} />
      </div>
      <p className="text-sm text-muted-foreground tabular-nums">{line.toNext}</p>
    </section>
  );
}
