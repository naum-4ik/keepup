import { todayIn } from "@/lib/dates";

export type GentleCardInput = {
  purpose: "me" | "family" | "friends" | null;
  hasCheckedIn: boolean;
  groups: { group_id: string; kind: string; role: string; child_count: number }[];
  dismissed: Set<string>;
  milestoneToday: boolean;
};
export type GentleCard = { key: "invite_family" | "invite_friend" } | { key: `add_child:${string}`; groupId: string };

// ideas/onboarding.md → "After the first check-in: gentle cards on Today". One at a time; never on a
// milestone day; each dismissable per user (dismissed_cards).
export function chooseGentleCard(i: GentleCardInput): GentleCard | null {
  if (!i.hasCheckedIn || i.milestoneToday) return null;
  if (i.groups.length === 0) {
    if (i.purpose === "family" && !i.dismissed.has("invite_family")) return { key: "invite_family" };
    if (i.purpose === "friends" && !i.dismissed.has("invite_friend")) return { key: "invite_friend" };
    return null;
  }
  const g = i.groups.find(
    (x) => x.kind === "family" && x.role === "admin" && x.child_count === 0 && !i.dismissed.has(`add_child:${x.group_id}`),
  );
  return g ? { key: `add_child:${g.group_id}`, groupId: g.group_id } : null;
}

// "Never on the same day as a milestone card": a milestone card is showing now (any unseen group
// milestone, whatever day it arrived), or one arrived on the user's local today, seen or not.
export function milestoneToday(
  feed: { kind: string; seen_at: string | null; created_at: string }[],
  timeZone: string,
  now: Date = new Date(),
): boolean {
  const today = todayIn(timeZone, now);
  return feed.some((n) => n.kind === "group_milestone" && (!n.seen_at || todayIn(timeZone, new Date(n.created_at)) === today));
}

// family_recaps(): the generated types say non-null, but best_* is null when no group streak is running.
export type FamilyRecap = {
  group_id: string;
  group_name: string;
  week_start: string;
  check_ins: number;
  best_title: string | null;
  best_emoji: string | null;
  best_streak: number | null;
  best_period: string | null;
};

const UNIT: Record<string, [string, string]> = { day: ["day", "days"], week: ["week", "weeks"], month: ["month", "months"] };
const plural = (n: number, [one, many]: [string, string]) => `${n} ${n === 1 ? one : many}`;

export const recapKey = (r: Pick<FamilyRecap, "group_id" | "week_start">) => `family_recap:${r.group_id}:${r.week_start}`;

// Wins only (§7): a week without check-ins shows nothing rather than a zero.
export function visibleRecaps<R extends FamilyRecap>(recaps: R[], dismissed: Set<string>): R[] {
  return recaps.filter((r) => r.check_ins > 0 && !dismissed.has(recapKey(r)));
}

// `streakShown`: a group milestone card for this group is on Today too, so the recap leaves the
// streak to it instead of saying it twice.
export function recapLine(r: FamilyRecap, streakShown = false): string {
  const line = `Together last week: ${plural(r.check_ins, ["check-in", "check-ins"])}`;
  if (streakShown || !r.best_title || !r.best_streak) return line;
  return `${line} · ${r.best_title} ${plural(r.best_streak, UNIT[r.best_period ?? "day"] ?? UNIT.day)} 🔥`;
}
