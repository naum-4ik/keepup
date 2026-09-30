import type { Database } from "@/lib/database.types";

type FeedRow = Database["public"]["Functions"]["inbox_feed"]["Returns"][number];
// The generated types mark every returned column as non-null; the joins and optional columns can be null.
type Nullable = "read_at" | "seen_at" | "group_id" | "group_name" | "habit_id" | "habit_title" | "habit_emoji" | "check_in_id"
  | "actor_name" | "subject_id" | "subject_name" | "subject_avatar_emoji";

export type FeedItem = Omit<FeedRow, "payload" | "kind" | Nullable> & { [K in Nullable]: FeedRow[K] | null } & {
  kind: Kind;
  payload: Record<string, unknown>;
};
type Kind =
  | "group_check_in" | "approval_needed" | "check_in_approved" | "check_in_rejected" | "everyone_done"
  | "group_streak_ended" | "group_milestone" | "group_habit_created" | "group_habit_paused" | "group_habit_resumed"
  | "group_habit_archived" | "member_paused" | "member_joined" | "member_left" | "role_changed" | "nudge" | "cheer"
  | "kid_check_in" | "kid_streak" | "kid_goal_reached" | "kid_garden_full";

// ideas/notifications-tone.md → "Words to avoid anywhere".
export const BANNED_WORDS = ["failed", "missed out", "don't lose", "hurry", "last chance", "only x left", "lazy"] as const;

export const NUDGE_KINDS = [
  { kind: "thinking_of_you", emoji: "👋", label: "Thinking of you" },
  { kind: "you_got_this", emoji: "💪", label: "You've got this" },
  { kind: "gentle_reminder", emoji: "⏰", label: "Gentle reminder" },
] as const;
export type NudgeKind = (typeof NUDGE_KINDS)[number]["kind"];

const UNIT: Record<string, [string, string]> = { day: ["day", "days"], week: ["week", "weeks"], month: ["month", "months"] };
const unit = (n: number, period: unknown) => (UNIT[String(period)] ?? UNIT.day)[n === 1 ? 0 : 1];
const THIS: Record<string, string> = { day: "today", week: "this week", month: "this month" };

export function feedCopy(n: FeedItem): { title: string; body: string; href: string | null } {
  const group = n.group_name ?? "Your group";
  const habit = n.habit_title ?? "a habit";
  const who = n.actor_name ?? "Someone";
  const kid = n.subject_name ?? "Your child";
  const streak = Number(n.payload.streak ?? 0);
  const habitHref = n.habit_id ? `/habits/${n.habit_id}` : null;
  const groupHref = n.group_id ? `/groups/${n.group_id}` : null;
  const kidHref = n.subject_id ? `/kids/${n.subject_id}` : null;

  switch (n.kind) {
    case "group_check_in": return { title: group, body: `${who} checked in: ${habit}`, href: habitHref };
    case "approval_needed": return { title: group, body: `${who} did ${habit}. Approve?`, href: "/inbox" };
    case "check_in_approved": return { title: habit, body: `${who} approved your check-in.`, href: habitHref };
    case "check_in_rejected": return { title: habit, body: `${who} didn't approve your check-in. You can check in again today.`, href: habitHref };
    case "everyone_done": return { title: group, body: `Everyone did it: ${habit} ✓`, href: habitHref };
    case "group_streak_ended":
      return { title: group, body: `${habit} streak ended at ${streak} ${unit(streak, n.payload.period)}. Start a new one ${THIS[String(n.payload.period)] ?? "today"}.`, href: habitHref };
    case "group_milestone": return { title: group, body: `🔥 ${habit}: ${streak} ${unit(streak, n.payload.period)} in a row, together`, href: habitHref };
    case "group_habit_created": return { title: group, body: `${who} added ${habit}.`, href: habitHref };
    case "group_habit_paused": return { title: group, body: n.payload.ends_on ? `${habit} is paused until ${String(n.payload.ends_on)}.` : `${habit} is paused.`, href: habitHref };
    case "group_habit_resumed": return { title: group, body: `${habit} is back.`, href: habitHref };
    case "group_habit_archived": return { title: group, body: `${habit} was archived.`, href: groupHref };
    case "member_paused": return { title: group, body: `${who} paused ${habit} for a while.`, href: habitHref };
    case "member_joined": return { title: group, body: `${who} joined ${group} 👋`, href: groupHref };
    case "member_left": return { title: group, body: n.payload.removed ? `${who} was removed from ${group}.` : `${who} left ${group}.`, href: groupHref };
    case "role_changed": return { title: group, body: n.payload.role === "admin" ? `You're now an admin of ${group}.` : `You're now a member of ${group}.`, href: groupHref };
    case "nudge": {
      // Copy sheet: "Thinking of you" asks about today; the other two name the habit.
      if (n.payload.kind === "thinking_of_you" || !NUDGE_KINDS.some((k) => k.kind === n.payload.kind)) {
        return { title: habit, body: `${who}: Thinking of you. ${habit} today?`, href: habitHref };
      }
      const label = NUDGE_KINDS.find((k) => k.kind === n.payload.kind)!.label;
      return { title: habit, body: `${who}: ${label}: ${habit}`, href: habitHref };
    }
    case "cheer": return { title: habit, body: `${who} cheered your check-in ❤️`, href: habitHref };
    case "kid_check_in":
      return { title: kid, body: n.actor_name ? `${who} logged ${habit} for ${kid} ⭐` : `${kid} did it: ${habit} ⭐`, href: kidHref };
    case "kid_streak": return { title: kid, body: `${kid}: ${streak} days of ${habit} 🔥`, href: kidHref };
    case "kid_goal_reached": return { title: kid, body: `${kid} reached a goal: ${String(n.payload.title ?? "")} ${String(n.payload.emoji ?? "")}`.trim(), href: kidHref };
    case "kid_garden_full": return { title: kid, body: `${kid}'s garden is in full bloom this week 🌷`, href: kidHref };
  }
}
