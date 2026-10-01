import type { Database } from "@/lib/database.types";
import * as copy from "@/lib/notification-copy";
import type { NudgeKind, PeriodUnit } from "@/lib/notification-copy";

type FeedRow = Database["public"]["Functions"]["inbox_feed"]["Returns"][number];
// The generated types mark every returned column as non-null; the joins and optional columns can be null.
type Nullable = "read_at" | "seen_at" | "group_id" | "group_name" | "habit_id" | "habit_title" | "habit_emoji" | "check_in_id"
  | "actor_name" | "subject_id" | "subject_name" | "subject_avatar_emoji";

export type FeedItem = Omit<FeedRow, "payload" | "kind" | Nullable> & { [K in Nullable]: FeedRow[K] | null } & {
  kind: Kind;
  payload: Record<string, unknown>;
};
// Every kind this app has a line for. The database ships first (deploy order), so the feed can hold
// kinds a slightly older app doesn't know yet; the Inbox and the bell skip those instead of crashing.
export const FEED_KINDS = [
  "group_check_in", "approval_needed", "check_in_approved", "check_in_rejected", "everyone_done",
  "group_streak_ended", "group_milestone", "group_habit_created", "group_habit_paused", "group_habit_resumed",
  "group_habit_archived", "member_paused", "member_joined", "member_left", "role_changed", "nudge", "cheer",
  "kid_check_in", "kid_streak", "kid_goal_reached", "kid_garden_full",
] as const;
type Kind = (typeof FEED_KINDS)[number];

export function isFeedKind(kind: string): kind is Kind {
  return (FEED_KINDS as readonly string[]).includes(kind);
}

export const NUDGE_KINDS: readonly { kind: NudgeKind; emoji: string; label: string }[] = [
  { kind: "thinking_of_you", emoji: "👋", label: "Thinking of you" },
  { kind: "you_got_this", emoji: "💪", label: "You've got this" },
  { kind: "gentle_reminder", emoji: "⏰", label: "Gentle reminder" },
];

const asPeriod = (p: unknown, fallback: PeriodUnit): PeriodUnit => (p === "day" || p === "week" || p === "month" ? p : fallback);
const UNIT: Record<string, [string, string]> = { day: ["day", "days"], week: ["week", "weeks"], month: ["month", "months"] };
const unit = (n: number, period: unknown) => (UNIT[String(period)] ?? UNIT.day)[n === 1 ? 0 : 1];
const THIS: Record<string, string> = { day: "today", week: "this week", month: "this month" };
const SCHEDULE: Record<PeriodUnit, string> = { day: "daily", week: "weekly", month: "monthly" };

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
    case "group_check_in": return { ...copy.groupCheckIn(group, [who], habit), href: habitHref };
    case "approval_needed": return { ...copy.approvalNeeded(group, [{ author: who, habit }]), href: "/inbox" };
    case "check_in_approved": return { title: habit, body: `${who} approved your check-in.`, href: habitHref };
    case "check_in_rejected": return { ...copy.checkInNotApproved(habit, who, asPeriod(n.payload.period, "day")), href: habitHref };
    case "everyone_done": return { ...copy.everyoneDidIt(group, habit), href: habitHref };
    case "group_streak_ended": {
      // Copy sheet: streaks under 3 get no message. The feed row still exists, so keep the plain line for it.
      const ended = copy.groupStreakEnded(group, habit, streak, asPeriod(n.payload.period, "day"));
      if (ended) return { ...ended, href: habitHref };
      return { title: group, body: `${habit} streak ended at ${streak} ${unit(streak, n.payload.period)}. Start a new one ${THIS[String(n.payload.period)] ?? "today"}.`, href: habitHref };
    }
    case "group_milestone": return { title: group, body: `🔥 ${habit}: ${streak} ${unit(streak, n.payload.period)} in a row, together`, href: habitHref };
    case "group_habit_created": {
      // The feed row carries the period, not the full schedule: "weekly" when known, none otherwise.
      const p = n.payload.period;
      if (p === "day" || p === "week" || p === "month") return { ...copy.groupHabitCreated(group, who, habit, SCHEDULE[p]), href: habitHref };
      return { title: group, body: `${who} added ${habit}.`, href: habitHref };
    }
    case "group_habit_paused": return { ...copy.groupHabitPaused(group, habit, n.payload.ends_on ? String(n.payload.ends_on) : null), href: habitHref };
    case "group_habit_resumed": return { ...copy.groupHabitResumed(group, habit), href: habitHref };
    case "group_habit_archived": return { title: group, body: `${habit} was archived.`, href: groupHref };
    case "member_paused": return { title: group, body: `${who} paused ${habit} for a while.`, href: habitHref };
    case "member_joined": return { ...copy.memberJoined(group, who), href: groupHref };
    case "member_left": return { title: group, body: n.payload.removed ? `${who} was removed from ${group}.` : `${who} left ${group}.`, href: groupHref };
    case "role_changed": return { title: group, body: n.payload.role === "admin" ? `You're now an admin of ${group}.` : `You're now a member of ${group}.`, href: groupHref };
    case "nudge": {
      const kind = NUDGE_KINDS.find((k) => k.kind === n.payload.kind)?.kind ?? "thinking_of_you";
      return { ...copy.nudge(kind, who, habit), href: habitHref };
    }
    case "cheer": return { title: habit, body: `${who} cheered your check-in ❤️`, href: habitHref };
    case "kid_check_in":
      return { title: kid, body: n.actor_name ? `${who} logged ${habit} for ${kid} ⭐` : `${kid} did it: ${habit} ⭐`, href: kidHref };
    case "kid_streak": return { ...copy.kidStreak(kid, streak, habit), href: kidHref };
    case "kid_goal_reached": {
      const goal = copy.kidTreatGoal(kid, String(n.payload.title ?? ""), String(n.payload.emoji ?? ""));
      return { ...goal, body: goal.body.trim(), href: kidHref };
    }
    case "kid_garden_full": return { ...copy.kidFullGarden(kid), href: kidHref };
  }
}
