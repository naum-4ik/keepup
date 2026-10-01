import type { HabitPeriod } from "@/lib/habit-schema";

// ideas/habit-end-date.md: the End chips, in the habit's own unit (a week to try something, then the longer runs).
export const END_PRESETS: Record<HabitPeriod, readonly number[]> = { day: [7, 30, 60, 90], week: [4, 8, 12], month: [3, 6, 12] };
const UNIT: Record<HabitPeriod, [string, string]> = { day: ["day", "days"], week: ["week", "weeks"], month: ["month", "months"] };
export const presetLabel = (n: number, period: HabitPeriod) => `${n} ${UNIT[period][n === 1 ? 0 : 1]}`;

const toDate = (d: string) => new Date(`${d}T00:00:00Z`);
const toStr = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: string, n: number) => toStr(new Date(toDate(d).getTime() + n * 86_400_000));
const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86_400_000);

function addMonths(d: string, n: number): string {
  const x = toDate(d);
  const target = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + n, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(x.getUTCDate(), lastDay));
  return toStr(target);
}

// The last day that counts for "n periods from the start" (the day before the n-th anniversary).
export function endsOnFor(startsOn: string, period: HabitPeriod, n: number): string {
  if (period === "day") return addDays(startsOn, n - 1);
  if (period === "week") return addDays(startsOn, n * 7 - 1);
  return addDays(addMonths(startsOn, n), -1);
}

function periodIndex(startsOn: string, day: string, period: HabitPeriod): number {
  if (period === "day") return daysBetween(startsOn, day) + 1;
  if (period === "week") return Math.floor(daysBetween(startsOn, day) / 7) + 1;
  const s = toDate(startsOn);
  const d = toDate(day);
  let n = (d.getUTCFullYear() - s.getUTCFullYear()) * 12 + (d.getUTCMonth() - s.getUTCMonth()) + 1;
  if (d.getUTCDate() < s.getUTCDate()) n -= 1;
  return n;
}

// "Day 12 of 30" while it runs; null before the start or after the end.
export function endProgress(
  startsOn: string,
  endsOn: string,
  today: string,
  period: HabitPeriod,
): { n: number; total: number; almost: boolean } | null {
  if (today < startsOn || today > endsOn) return null;
  const n = periodIndex(startsOn, today, period);
  const total = periodIndex(startsOn, endsOn, period);
  const almost = period === "day" ? total - n < 3 : n === total;
  return { n, total, almost };
}

export function endLabel(p: { n: number; total: number; almost: boolean }, period: HabitPeriod): string {
  const unit = UNIT[period][0];
  const text = `${unit[0].toUpperCase()}${unit.slice(1)} ${p.n} of ${p.total}`;
  return p.almost ? `Almost there · ${text}` : text;
}

// Extend by n more periods after the current end (the habit page's "+30 days").
export function extendEnd(endsOn: string, period: HabitPeriod, n: number): string {
  return endsOnFor(addDays(endsOn, 1), period, n);
}

// The habit page's end buttons. With an end: "+30 days" after it. Without: from the start, only
// lengths that end today or later. After the end, none: the rule refuses changes then
// (keepup:end_passed), and Keep going or Finish decide instead.
export function endOptions(
  startsOn: string,
  endsOn: string | null,
  today: string,
  period: HabitPeriod,
): { n: number; date: string; label: string }[] | null {
  if (hasEnded(endsOn, today)) return null;
  return END_PRESETS[period]
    .map((n) => ({ n, date: endsOn ? extendEnd(endsOn, period, n) : endsOnFor(startsOn, period, n) }))
    .filter((o) => o.date >= today)
    .map((o) => ({ ...o, label: endsOn ? `+${presetLabel(o.n, period)}` : presetLabel(o.n, period) }));
}

// A habit has ended once today, in its own calendar, is after its last day: no more check-ins.
export const hasEnded = (endsOn: string | undefined | null, today: string) => Boolean(endsOn) && (endsOn as string) < today;

// The habits still running today (kid views and Today's lists leave ended ones out).
export function withoutEnded<T extends { habit_id: string }>(habits: T[], ends: Map<string, string>, todayOf: (h: T) => string): T[] {
  return habits.filter((h) => !hasEnded(ends.get(h.habit_id), todayOf(h)));
}
