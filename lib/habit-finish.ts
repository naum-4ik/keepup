import type { HabitPeriod } from "@/lib/habit-schema";

const UNIT: Record<HabitPeriod, [string, string]> = { day: ["day", "days"], week: ["week", "weeks"], month: ["month", "months"] };

// The finish card (ideas/habit-end-date.md): what was done, never what wasn't.
export function finishLine(s: { done: number; total: number; best_streak: number }, period: HabitPeriod, together: boolean): string {
  const unit = UNIT[period][s.total === 1 ? 0 : 1];
  const main = `${together ? "Together you" : "You"} did ${s.done} of ${s.total} ${unit}`;
  return s.best_streak > 0 ? `${main} · best streak ${s.best_streak} 🔥` : main;
}

// Confetti and 🎉 only for at least half done; below that the card invites another go instead.
export function celebrates(s: { done: number; total: number }): boolean {
  return s.total > 0 && s.done * 2 >= s.total;
}

export const ANOTHER_GO = "Want to give it another go?";

const toDate = (d: string) => new Date(`${d}T00:00:00Z`).getTime();

// Start again: the same number of days as last time, starting today.
export function startAgainEnd(startsOn: string, endsOn: string, today: string): string {
  const days = Math.round((toDate(endsOn) - toDate(startsOn)) / 86_400_000);
  return new Date(toDate(today) + days * 86_400_000).toISOString().slice(0, 10);
}

// Finish cards take turns with their confetti (never two bursts at once): each waits until the one
// before it is over. The burst runs 900 ms; a little air after it. `turns.freeAt` is shared by the
// cards on screen; returns how long this card waits.
export const CONFETTI_TURN_MS = 1200;
export function takeConfettiTurn(turns: { freeAt: number }, now: number): number {
  const start = Math.max(now, turns.freeAt);
  turns.freeAt = start + CONFETTI_TURN_MS;
  return start - now;
}
