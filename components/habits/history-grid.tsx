import { formatLocalDate } from "@/lib/dates";
import type { Locale, T } from "@/supabase/functions/_shared/i18n";
import type { HabitPeriod } from "@/lib/habit-schema";
import type { HistoryCell } from "@/lib/habits";
import { outcomeLabel, type Outcome } from "@/lib/week-overview";
import { cn } from "@/lib/utils";

const STYLE: Record<string, string> = {
  done: "bg-done",
  missed: "bg-muted",
  rested: "bg-done/40",
  skipped: "bg-frozen/40",
  open: "border-2 border-dashed border-input",
};

export function HistoryGrid({ t, locale, cells, period }: { t: T; locale: Locale; cells: HistoryCell[]; period: HabitPeriod }) {
  // A habit that hasn't started has no periods yet: say how the grid fills instead of an empty box.
  if (cells.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing here yet. Each {period} you finish fills a square.</p>;
  }
  // "Rest day" joins the legend only when there is one to explain.
  const legend = ["done", "missed", "skipped", ...(cells.some((c) => c.outcome === "rested") ? ["rested"] : []), "open"];
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-wrap gap-1.5">
        {cells.map((c) => {
          const text = `${formatLocalDate(c.period_start, locale)}: ${outcomeLabel(t, c.outcome as Outcome)}`;
          return (
            <li key={c.period_start} title={text} className={cn(period === "day" ? "size-7" : "size-9", "rounded-md", STYLE[c.outcome])}>
              <span className="sr-only">{text}</span>
            </li>
          );
        })}
      </ol>
      <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground" aria-hidden>
        {legend.map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded-sm", STYLE[k])} />
            {outcomeLabel(t, k as Outcome)}
          </li>
        ))}
      </ul>
    </div>
  );
}
