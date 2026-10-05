import { formatLocalDate } from "@/lib/dates";
import type { HabitPeriod } from "@/lib/habit-schema";
import type { HistoryCell } from "@/lib/habits";
import { OUTCOME_LABEL } from "@/lib/week-overview";
import { cn } from "@/lib/utils";

const STYLE: Record<string, string> = {
  done: "bg-done",
  missed: "bg-muted",
  rested: "bg-done/40",
  skipped: "bg-frozen/40",
  open: "border-2 border-dashed border-input",
};
const LABEL: Record<string, string> = OUTCOME_LABEL;

export function HistoryGrid({ cells, period }: { cells: HistoryCell[]; period: HabitPeriod }) {
  // "Rest day" joins the legend only when there is one to explain.
  const legend = ["done", "missed", "skipped", ...(cells.some((c) => c.outcome === "rested") ? ["rested"] : []), "open"];
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-wrap gap-1.5">
        {cells.map((c) => {
          const text = `${formatLocalDate(c.period_start)}: ${LABEL[c.outcome]}`;
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
            {LABEL[k]}
          </li>
        ))}
      </ul>
    </div>
  );
}
