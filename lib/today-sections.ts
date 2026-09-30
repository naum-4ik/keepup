import type { HabitSummary } from "@/lib/habits";

export type Member = {
  profile_id: string;
  name: string;
  avatar_emoji: string | null;
  avatar_color: string | null;
  kind: "adult" | "child";
  required: boolean;
  done_count: number;
  pending_count: number;
  paused: boolean;
};
export type MemberStatus = "done" | "pending" | "paused" | "open" | "not_required";

// "paused" is checked before "not required": a paused member is also not required, and the more
// specific state should show.
export function memberStatus(m: Member, target: number): MemberStatus {
  if (m.done_count >= target) return "done";
  if (m.paused) return "paused";
  if (!m.required) return "not_required";
  if (m.done_count + m.pending_count >= target) return "pending";
  return "open";
}

// `members` arrives as JSON from habit_summaries(); null for private habits.
export const membersOf = (h: Pick<HabitSummary, "members">): Member[] | null =>
  Array.isArray(h.members) ? (h.members as unknown as Member[]) : null;

// "Everyone did it ✓" on a group habit: the group's period is done, and so am I (or I'm paused).
// Someone who joined mid-period isn't required yet, so the group can be done while their own
// check-in is still open; they see their own progress instead.
export const everyoneDidIt = (h: Pick<HabitSummary, "members" | "group_done" | "done_count" | "target_count" | "frozen">): boolean =>
  Boolean(membersOf(h) && h.group_done && (h.done_count >= h.target_count || h.frozen));

export type TodaySection = { key: string; title: string; habits: HabitSummary[] };

// Today: "Mine" first, then one section per group by name; empty sections are dropped.
export function sectionsForToday(habits: HabitSummary[]): TodaySection[] {
  const mine = habits.filter((x) => !x.group_id);
  const groups = new Map<string, TodaySection>();
  for (const x of habits) {
    if (!x.group_id) continue;
    const g = groups.get(x.group_id) ?? { key: x.group_id, title: x.group_name ?? "Group", habits: [] };
    g.habits.push(x);
    groups.set(x.group_id, g);
  }
  return [{ key: "mine", title: "Mine", habits: mine }, ...[...groups.values()].sort((a, b) => a.title.localeCompare(b.title))]
    .filter((s) => s.habits.length > 0);
}
