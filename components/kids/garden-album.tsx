import { GardenPicture } from "@/components/kids/garden";

const WEEK = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

// Past weeks' gardens, newest first, in a horizontal scroll-snap strip.
// Past weeks are drawn in the child's current theme.
export function GardenAlbum({ weeks, theme }: { weeks: { week_start: string; stars: number }[]; theme?: string | null }) {
  if (weeks.length === 0) return null;
  return (
    <section aria-label="Garden album" className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-soft">
      <h2 className="text-sm font-bold text-muted-foreground">Garden album</h2>
      <ul className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1">
        {weeks.map((w) => (
          <li key={w.week_start} className="flex shrink-0 snap-start flex-col gap-1.5">
            <GardenPicture stars={w.stars} size="sm" theme={theme} />
            <span className="text-xs text-muted-foreground">
              Week of {WEEK.format(new Date(`${w.week_start}T00:00:00Z`))} · ⭐ {w.stars}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
