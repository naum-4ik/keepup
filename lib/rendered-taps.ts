// The check-ins a page is drawn with, by client id (lib/offline-queue.ts queuedDelta): only the ones
// in each habit's current period (the counts the page shows) and only the viewer's own or their
// children's (the only taps this phone queues). A queued undo of last week's tap then takes nothing
// from this week's count, and other members' rows never match.
export type TapRow = { client_id: string | null; habit_id: string; user_id: string; period_start: string };

export function renderedTapIds(rows: readonly TapRow[], subjects: Iterable<string>, currentPeriod: ReadonlyMap<string, string>): string[] {
  const who = new Set(subjects);
  return rows.flatMap((r) => (r.client_id && who.has(r.user_id) && currentPeriod.get(r.habit_id) === r.period_start ? [r.client_id] : []));
}

// habit id → its current period's start, from the summaries a page draws.
export const currentPeriods = (habits: readonly { habit_id: string; period_start: string }[]): Map<string, string> =>
  new Map(habits.map((h) => [h.habit_id, h.period_start]));
