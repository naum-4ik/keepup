import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MonthHeatmap } from "@/components/recaps/month-heatmap";
import { getProfile } from "@/lib/auth";
import { getRecaps } from "@/lib/recaps-data";
import { recapLine, recapTitle, streakLabel } from "@/lib/recaps";

// Past recaps (ideas/achievements-and-rewards.md §6): the last 8 weeks and 6 months, wins first.
export default async function RecapsPage() {
  const [{ profile }, weeks, months] = await Promise.all([getProfile(), getRecaps("week", 8), getRecaps("month", 6)]);
  const weekStart = (profile.week_start === 0 ? 0 : 1) as 0 | 1;

  return (
    <section className="flex flex-col gap-5 py-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Recaps</h1>
        <Link href="/progress" className="flex h-11 items-center rounded-full px-3 text-sm font-semibold text-primary hover:bg-muted">
          Back to Progress
        </Link>
      </div>

      <section aria-label="Weeks" className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-muted-foreground">Weeks</h2>
        {weeks.length === 0 ? (
          <EmptyState icon={<CalendarCheck className="size-6" />}>
            Your first weekly recap arrives on the first day of next week.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {weeks.map((r) => (
              <li key={r.start} className="flex flex-col gap-1 rounded-2xl bg-card p-4 shadow-soft">
                <p className="text-xs font-semibold text-muted-foreground">{recapTitle(r)}</p>
                <p className="font-semibold">{recapLine(r)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {months.length > 0 && (
        <section aria-label="Months" className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-muted-foreground">Months</h2>
          <ul className="flex flex-col gap-3">
            {months.map((r) => {
              const rested = r.days.reduce((n, d) => n + d.rested, 0);
              return (
                <li key={r.start} className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-soft">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">{recapTitle(r)}</p>
                    <p className="font-semibold">{recapLine(r)}</p>
                  </div>
                  <MonthHeatmap recap={r} weekStart={weekStart} />
                  {rested > 0 && <p className="text-sm text-muted-foreground">Rest days: {rested} (dashed)</p>}
                  {r.top.length > 0 && (
                    <ul aria-label="Top streaks" className="flex flex-col gap-1 text-sm">
                      {r.top.map((s) => <li key={s.title}>{s.emoji} {streakLabel(s)}</li>)}
                    </ul>
                  )}
                  {r.badges.length > 0 && (
                    <p className="text-sm text-muted-foreground">Badges: {r.badges.map((b) => b.name).join(", ")}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </section>
  );
}
