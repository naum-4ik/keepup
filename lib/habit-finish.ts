import type { HabitPeriod } from "@/lib/habit-schema";
import type { T } from "@/supabase/functions/_shared/i18n";

// The finish card (ideas/habit-end-date.md): what was done, never what wasn't.
export function finishLine(t: T, s: { done: number; total: number; best_streak: number }, period: HabitPeriod, together: boolean): string {
  const main = t("habitFinish.did", { together: together ? "yes" : "no", done: s.done, span: t(`units.${period}`, { n: s.total }) });
  return s.best_streak > 0 ? t("habitFinish.withBest", { main, n: s.best_streak }) : main;
}

// Confetti and 🎉 only for at least half done; below that the card invites another go instead.
export function celebrates(s: { done: number; total: number }): boolean {
  return s.total > 0 && s.done * 2 >= s.total;
}

// The card invites another go with the catalog line `habitFinish.anotherGo`.

const toDate = (d: string) => new Date(`${d}T00:00:00Z`).getTime();

// Start again: the same number of days as last time, starting today.
export function startAgainEnd(startsOn: string, endsOn: string, today: string): string {
  const days = Math.round((toDate(endsOn) - toDate(startsOn)) / 86_400_000);
  return new Date(toDate(today) + days * 86_400_000).toISOString().slice(0, 10);
}
