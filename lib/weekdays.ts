import { INTL_LOCALE, type Locale } from "@/supabase/functions/_shared/i18n";

// "two": English keeps its two-letter names ("Su"); other scripts use the locale's narrow ones.
export type WeekdayWidth = "narrow" | "short" | "two" | "long";

// Weekday column headers, Sunday first (callers rotate for the week start), from a fixed
// reference week (2026-01-04 is a Sunday).
export function weekdayLabels(locale: Locale, width: WeekdayWidth): string[] {
  const intlWidth = width === "long" ? "long" : width === "short" || (width === "two" && locale === "en") ? "short" : "narrow";
  const f = new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: intlWidth, timeZone: "UTC" });
  const names = Array.from({ length: 7 }, (_, i) => f.format(new Date(Date.UTC(2026, 0, 4 + i))));
  return width === "two" && locale === "en" ? names.map((n) => n.slice(0, 2)) : names;
}

// Rotate a Sunday-first list to start on `weekStart` (0 = Sunday, 1 = Monday).
export const fromWeekStart = <T,>(list: T[], weekStart: 0 | 1): T[] => [...list.slice(weekStart), ...list.slice(0, weekStart)];
