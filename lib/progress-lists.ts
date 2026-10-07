// lib/progress-lists.ts
// Progress → Active / Finished / Archived. A habit past its end (ideas/habit-end-date.md) takes no
// more check-ins: Today moves it out of its lists to a finish card (Keep going or Finish), so it isn't
// Active here either. Until it is finished it shows under Finished, as ended; once finished (archived
// with finished_at) it stays there with Start again. Plain archived habits are Archived.
export type ProgressTab = "active" | "finished" | "archived";

export function inProgressTab<T extends { habit_id: string; archived_at: string | null }>(
  h: T,
  tab: ProgressTab,
  finishedIds: ReadonlySet<string>,
  ended: (h: T) => boolean,
): boolean {
  if (!h.archived_at) return tab === (ended(h) ? "finished" : "active");
  return tab === (finishedIds.has(h.habit_id) ? "finished" : "archived");
}
