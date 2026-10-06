import type { BadgeGroup } from "@/lib/badges";
import { cn } from "@/lib/utils";

// All 24 badges by group (ideas/achievements-and-rewards.md §4). Earned: colour, name and date. Locked:
// a soft outline and a one-line hint. No tiers, nothing to feel behind on.
export function BadgeGrid({ groups, timeZone }: { groups: BadgeGroup[]; timeZone: string }) {
  if (groups.length === 0) return null;
  const day = new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short" });
  const earned = groups.reduce((n, g) => n + g.badges.filter((b) => b.earnedAt).length, 0);
  const total = groups.reduce((n, g) => n + g.badges.length, 0);
  return (
    <section aria-label="Achievements" className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground tabular-nums">
        {earned} of {total} earned
      </p>
      {groups.map((g) => (
        <div key={g.key} className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-soft">
          <h2 className="text-sm font-bold">{g.label}</h2>
          <ul className="grid grid-cols-3 gap-x-2 gap-y-4 min-[400px]:grid-cols-4">
            {g.badges.map((b) => {
              const Icon = b.icon;
              const label = b.earnedAt ? `${b.name}, earned ${day.format(new Date(b.earnedAt))}` : `${b.name}, locked: ${b.hint}`;
              return (
                <li key={b.code} aria-label={label} className="flex flex-col items-center gap-1 text-center">
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-12 items-center justify-center rounded-full",
                      b.earnedAt ? cn(g.chip, g.ink) : "border-2 border-dashed border-border text-muted-foreground/60",
                    )}
                  >
                    <Icon className="size-6" strokeWidth={1.75} />
                  </span>
                  <span aria-hidden className={cn("text-xs font-semibold", !b.earnedAt && "text-muted-foreground")}>
                    {b.name}
                  </span>
                  <span aria-hidden className="text-[0.6875rem] leading-tight text-muted-foreground">
                    {b.earnedAt ? day.format(new Date(b.earnedAt)) : b.hint}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
