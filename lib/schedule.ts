import { addDays, addMonthsToDate, formatLocalDate } from "@/lib/dates";
import type { HabitPeriod } from "@/lib/habit-schema";
import type { Locale, T } from "@/supabase/functions/_shared/i18n";

export function describeSchedule(t: T, targetCount: number, period: HabitPeriod): string {
  return targetCount === 1 ? t(`schedule.once.${period}`) : t("schedule.timesPer", { n: targetCount, unit: period });
}

export type QuickPick = { label: string; date: string };

// Quick picks for a pause's optional end date, relative to when the pause starts
// (unlike the start-date picker's Today/Tomorrow/Next-weekday, which are relative to today).
export function pauseEndQuickPicks(t: T, startsOn: string): QuickPick[] {
  return [
    { label: t("units.week", { n: 1 }), date: addDays(startsOn, 7) },
    { label: t("units.week", { n: 2 }), date: addDays(startsOn, 14) },
    { label: t("units.month", { n: 1 }), date: addMonthsToDate(startsOn, 1) },
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

export function describeProgress(t: T, locale: Locale, p: ProgressInput): { text: string; atRisk: boolean } {
  if (p.notStarted && p.startsOn) return { text: t("schedule.progress.starts", { date: formatLocalDate(p.startsOn, locale) }), atRisk: false };
  if (p.frozen) {
    return { text: p.frozenUntil ? t("schedule.progress.pausedUntil", { date: formatLocalDate(p.frozenUntil, locale) }) : t("schedule.progress.paused"), atRisk: false };
  }
  const remaining = Math.max(p.targetCount - p.doneCount, 0);
  if (p.period === "day") {
    if (remaining === 0) return { text: t("schedule.progress.doneToday"), atRisk: false };
    if (p.targetCount === 1) return { text: t("schedule.progress.notDoneYet"), atRisk: false };
    return { text: t("schedule.progress.todayCount", { done: p.doneCount, target: p.targetCount }), atRisk: false };
  }
  if (remaining === 0) return { text: t("schedule.progress.doneForPeriod", { period: p.period }), atRisk: false };
  const base = t("schedule.progress.periodCount", { done: p.doneCount, target: p.targetCount, period: p.period });
  const left = t("schedule.progress.daysLeft", { n: p.daysLeft });
  // At risk: no spare day left (one check-in per day on weekly/monthly habits).
  return { text: `${base} · ${left}`, atRisk: remaining >= p.daysLeft };
}

// "pending": checked in, and the check-ins that would finish the period await approval.
export type CheckInState = "open" | "done" | "pending" | "checked-today" | "frozen" | "not-started";

export function checkInState(p: {
  targetCount: number;
  period: HabitPeriod;
  doneCount: number;
  checkedInToday: boolean;
  frozen: boolean;
  notStarted?: boolean;
  pendingCount?: number;
}): CheckInState {
  if (p.notStarted) return "not-started";
  if (p.frozen) return "frozen";
  if (p.doneCount >= p.targetCount) return "done";
  if (p.doneCount + (p.pendingCount ?? 0) >= p.targetCount) return "pending";
  if (p.period !== "day" && p.checkedInToday) return "checked-today";
  return "open";
}
