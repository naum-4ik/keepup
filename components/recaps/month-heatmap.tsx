import { monthGrid } from "@/lib/calendar";
import { heatLevel, heatmapDayTitle, type Recap } from "@/lib/recaps";
import { cn } from "@/lib/utils";
import { fromWeekStart, weekdayLabels } from "@/lib/weekdays";
import type { Locale, T } from "@/supabase/functions/_shared/i18n";

const SHADE = [
  "bg-transparent",
  "bg-done/15",
  "bg-done/40",
  "bg-done/70",
  "bg-done",
] as const;

// A month's daily habits as a small calendar: deeper sage for more done. Never red; empty days stay
// blank; a rest day is outlined and titled "Rest day".
export function MonthHeatmap({
  recap,
  weekStart,
  t,
  locale,
}: {
  recap: Recap;
  weekStart: 0 | 1;
  t: T;
  locale: Locale;
}) {
  const byDate = new Map(recap.days.map((d) => [d.date, d]));
  const weeks = monthGrid(recap.start.slice(0, 7), weekStart);
  const full = recap.days.filter(
    (d) => d.possible > 0 && d.done >= d.possible,
  ).length;
  const head = fromWeekStart(weekdayLabels(locale, "narrow"), weekStart);
  return (
    <div>
      <div
        aria-hidden
        className="mb-1 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground"
      >
        {head.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
      <div
        role="img"
        aria-label={t("recaps.heatmap.fullDays", { n: full })}
        className="grid grid-cols-7 gap-1"
      >
        {weeks.flat().map((date, i) => {
          const d = date ? byDate.get(date) : undefined;
          const rested = (d?.rested ?? 0) > 0;
          const title = heatmapDayTitle(t, locale, d);
          return (
            <span
              key={date ?? `pad-${i}`}
              title={title}
              className={cn(
                "aspect-square rounded-sm",
                date ? SHADE[heatLevel(d?.done ?? 0, d?.possible ?? 0)] : "",
                date && (!d || rested) && "border border-border/60",
                rested && "border-dashed border-done",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
