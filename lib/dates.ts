// Local dates are "YYYY-MM-DD" strings in the user's time zone (Postgres `date`).
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(localDate: string, days: number): string {
  const [y, m, d] = localDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function formatLocalDate(localDate: string): string {
  const [y, m, d] = localDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" })
    .format(new Date(Date.UTC(y, m - 1, d)))
    .replace(",", "");
}

function weekday(localDate: string): number {
  const [y, m, d] = localDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// The first day of next week, strictly after `localDate` (weekStart: 0 = Sunday, 1 = Monday).
export function nextWeekStart(localDate: string, weekStart: 0 | 1): string {
  return addDays(localDate, ((weekStart - weekday(localDate) + 7) % 7) || 7);
}

// Days of a month ("YYYY-MM") laid out in week rows; null pads the first and last week.
export function monthGrid(month: string, weekStart: 0 | 1): (string | null)[] {
  const first = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (weekday(first) - weekStart + 7) % 7;
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let i = 0; i < days; i++) cells.push(addDays(first, i));
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

// Like addMonths, but on a full "YYYY-MM-DD" date (keeps the day of month) rather than a month.
export function addMonthsToDate(localDate: string, months: number): string {
  const [y, m, d] = localDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + months, d)).toISOString().slice(0, 10);
}

export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, 1)));
}
