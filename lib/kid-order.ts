import type { CheckInState } from "@/lib/schedule";

// The kid view's list order (ideas/kid-view-next.md, decided 2026-10-04): what's left to do first, done
// ones at the bottom, each group in its original order, so the next thing to tap is always near the
// picture. "Done" is anything but open, the same as the green card (done, pending, checked-today).
export const isDoneForKid = (h: { state: CheckInState }): boolean => h.state !== "open";

export function orderForKid<T extends { state: CheckInState }>(habits: readonly T[]): T[] {
  return [...habits.filter((h) => !isDoneForKid(h)), ...habits.filter(isDoneForKid)];
}

// The list as shown: the order the cards were last settled in (a card that just turned green waits
// there a moment before it slides down). Habits not in that order yet go at the end; gone ones drop out.
export function inOrder<T extends { id: string }>(order: readonly string[], habits: readonly T[]): T[] {
  const byId = new Map(habits.map((h) => [h.id, h]));
  const known = order.filter((id) => byId.has(id));
  const seen = new Set(known);
  return [...known.map((id) => byId.get(id)!), ...habits.filter((h) => !seen.has(h.id))];
}
