// Which "today" a new habit starts from: a group habit runs on its group's calendar (time zone), a
// private one on the person's. The server decides the real start; this keeps the start chips, the
// calendar's earliest day and the "today means empty" rule in step with it.
export const todayForGroup = (groups: readonly { id: string; today: string }[], groupId: string, fallback: string): string =>
  groups.find((g) => g.id === groupId)?.today ?? fallback;

// Switching who it's for moves an untouched start ("today") to the new calendar's today, and never
// leaves a start before it. A later day the person picked stays.
export function startAfterSwitch(startsOn: string, oldToday: string, newToday: string): string {
  return startsOn === oldToday || startsOn < newToday ? newToday : startsOn;
}
