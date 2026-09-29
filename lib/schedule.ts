import { addDays, addMonthsToDate, formatLocalDate } from "@/lib/dates";
import type { HabitPeriod } from "@/lib/habit-schema";

const ONCE: Record<HabitPeriod, string> = { day: "Daily", week: "Weekly", month: "Monthly" };

export function describeSchedule(targetCount: number, period: HabitPeriod): string {
  return targetCount === 1 ? ONCE[period] : `${targetCount}× a ${period}`;
}

export type QuickPick = { label: string; date: string };

// Quick picks for a pause's optional end date, relative to when the pause starts
// (unlike the start-date picker's Today/Tomorrow/Next-weekday, which are relative to today).
export function pauseEndQuickPicks(startsOn: string): QuickPick[] {
  return [
    { label: "1 week", date: addDays(startsOn, 7) },
    { label: "2 weeks", date: addDays(startsOn, 14) },
    { label: "1 month", date: addMonthsToDate(startsOn, 1) },
  ];
}

export type ProgressInput = {
  targetCount: number;
  period: HabitPeriod;
  doneCount: number;
  daysLeft: number;
  frozen: boolean;
  frozenUntil: string | null;
  notStarted?: boolean;
  startsOn?: string;
};

export function describeProgress(p: ProgressInput): { text: string; atRisk: boolean } {
  if (p.notStarted && p.startsOn) return { text: `Starts ${formatLocalDate(p.startsOn)}`, atRisk: false };
  if (p.frozen) {
    return { text: p.frozenUntil ? `Paused until ${formatLocalDate(p.frozenUntil)}` : "Paused", atRisk: false };
  }
  const remaining = Math.max(p.targetCount - p.doneCount, 0);
  if (p.period === "day") {
    if (remaining === 0) return { text: "Done for today", atRisk: false };
    if (p.targetCount === 1) return { text: "Not done yet", atRisk: false };
    return { text: `${p.doneCount} / ${p.targetCount} today`, atRisk: false };
  }
  if (remaining === 0) return { text: `Done for this ${p.period}`, atRisk: false };
  const base = `${p.doneCount} of ${p.targetCount} this ${p.period}`;
  const left = `${p.daysLeft} ${p.daysLeft === 1 ? "day" : "days"} left`;
  // At risk: no spare day left (one check-in per day on weekly/monthly habits).
  return { text: `${base} · ${left}`, atRisk: remaining >= p.daysLeft };
}

export type CheckInState = "open" | "done" | "checked-today" | "frozen" | "not-started";

export function checkInState(p: {
  targetCount: number;
  period: HabitPeriod;
  doneCount: number;
  checkedInToday: boolean;
  frozen: boolean;
  notStarted?: boolean;
}): CheckInState {
  if (p.notStarted) return "not-started";
  if (p.frozen) return "frozen";
  if (p.doneCount >= p.targetCount) return "done";
  if (p.period !== "day" && p.checkedInToday) return "checked-today";
  return "open";
}
