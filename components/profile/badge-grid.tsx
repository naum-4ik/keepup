import { BadgeNotes, BadgeTile } from "@/components/profile/badge-tile";
import type { BadgeGroup } from "@/lib/badges";

// All 24 badges by group (ideas/achievements-and-rewards.md §4). Earned: full colour. Locked: the same
// icon, greyed. Just the icon and the name; the date or the hint shows on hover, tap or focus (owner,
// 2026-10-06). No tiers, nothing to feel behind on.
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
      <BadgeNotes>
        {groups.map((g) => (
          <div key={g.key} className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-soft">
            <h2 className="text-sm font-bold">{g.label}</h2>
            <ul className="grid grid-cols-3 gap-x-2 gap-y-3 min-[400px]:grid-cols-4">
              {g.badges.map((b) => {
                const Icon = b.icon;
                const date = b.earnedAt ? day.format(new Date(b.earnedAt)) : null;
                return (
                  <li key={b.code} className="flex">
                    <BadgeTile
                      code={b.code}
                      name={b.name}
                      label={date ? `${b.name}, earned ${date}` : `${b.name}, locked: ${b.hint}`}
                      note={date ? `Earned ${date}` : b.hint}
                      earned={Boolean(date)}
                      chip={g.chip}
                      ink={g.ink}
                    >
                      <Icon className="size-6" strokeWidth={1.75} />
                    </BadgeTile>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </BadgeNotes>
    </section>
  );
}
