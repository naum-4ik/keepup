import type { DayHabit, DayRow, DayRowStatus } from "@/lib/day-detail";

// Progress → Calendar (ideas/progress-calendar.md). Pure helpers: the month grid, ?m= parsing, and
// turning calendar_cells rows into each day's circle and list.
export type CalendarCell = { local_date: string; habit_id: string; outcome: string | null; check_ins: number };
export type CalendarDay = { done: number; possible: number; rows: DayRow[] };

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const pad = (n: number) => String(n).padStart(2, "0");

export function parseMonth(raw: string | undefined, today: string): string {
  const current = today.slice(0, 7);
  return raw && MONTH.test(raw) && raw <= current ? raw : current;
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

// Weeks of 7 cells starting on weekStart (0 = Sunday, 1 = Monday); null outside the month.
export function monthGrid(month: string, weekStart: 0 | 1): (string | null)[][] {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const lead = (firstDow - weekStart + 7) % 7;
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${pad(i + 1)}`)];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

const ORDER: Record<DayRowStatus, number> = { done: 0, checked_in: 1, open: 2, missed: 3, paused: 4 };

export function summarizeDays(cells: CalendarCell[], habits: DayHabit[]): Map<string, CalendarDay> {
  const byId = new Map(habits.map((h) => [h.habit_id, h]));
  const out = new Map<string, CalendarDay>();
  for (const c of cells) {
    const h = byId.get(c.habit_id);
    if (!h) continue;
    let status: DayRowStatus | null = null;
    if (h.period === "day") {
      if (c.outcome === "done" || c.outcome === "missed" || c.outcome === "open") status = c.outcome;
    } else if (c.check_ins > 0) {
      status = "checked_in";
    }
    const day = out.get(c.local_date) ?? { done: 0, possible: 0, rows: [] };
    if (h.period === "day" && c.outcome === "done") day.done += 1;
    // Like the week strip: today's open daily habits count as possible right away.
    if (h.period === "day" && (c.outcome === "done" || c.outcome === "missed" || c.outcome === "open")) day.possible += 1;
    if (status) day.rows.push({ habitId: h.habit_id, title: h.title, emoji: h.emoji, category: h.category, status, count: c.check_ins, pending: 0 });
    out.set(c.local_date, day);
  }
  for (const d of out.values()) d.rows.sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  return out;
}
