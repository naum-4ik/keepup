import { getT } from "@/lib/i18n/server";
import { levelLine, levelProgress } from "@/lib/levels";

// Profile: "Level 7 · Sprout" with a bar to the next level (ideas/achievements-and-rewards.md §3).
// Adults only: the kid view never shows XP. One stat, so a headed block on the page, not a card.
export async function LevelCard({ xp }: { xp: number }) {
  const { t } = await getT();
  const p = levelProgress(xp);
  const line = levelLine(t, xp);
  return (
    <section aria-labelledby="level-title" className="flex flex-col gap-inner">
      <h2 id="level-title" className="text-base font-bold">{line.title}</h2>
      <div
        role="progressbar"
        aria-label={t("profile.level.xpLabel", { next: p.level + 1 })}
        aria-valuemin={0}
        aria-valuemax={p.span}
        aria-valuenow={p.into}
        // On the page (no card under it): the track one step darker than muted, so it reads on cream.
        className="h-2.5 overflow-hidden rounded-full bg-border"
      >
        <div className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${Math.round((p.into / p.span) * 100)}%` }} />
      </div>
      <p className="text-sm text-muted-foreground tabular-nums">{line.toNext}</p>
    </section>
  );
}
