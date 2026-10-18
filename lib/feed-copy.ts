import type { Database } from "@/lib/database.types";
import { formatLocalDate } from "@/lib/dates";
import * as copy from "@/lib/notification-copy";
import { levelName } from "@/lib/levels";
import { NUDGE_KINDS } from "@/lib/nudge-kinds";
import { badgeName } from "@/lib/badges";
import type { PeriodUnit } from "@/lib/notification-copy";
import { INTL_LOCALE, isolate, type Locale, type T } from "@/supabase/functions/_shared/i18n";

type FeedRow = Database["public"]["Functions"]["inbox_feed"]["Returns"][number];
// The generated types mark every returned column as non-null; the joins and optional columns can be null.
type Nullable = "read_at" | "seen_at" | "group_id" | "group_name" | "habit_id" | "habit_title" | "habit_emoji" | "habit_template" | "check_in_id"
  | "actor_name" | "actor_avatar_emoji" | "actor_avatar_color" | "subject_id" | "subject_name" | "subject_avatar_emoji" | "subject_gender";

export type FeedItem = Omit<FeedRow, "payload" | "kind" | Nullable> & { [K in Nullable]: FeedRow[K] | null } & {
  kind: Kind;
  payload: Record<string, unknown>;
};
// Every kind this app has a line for. The database ships first (deploy order), so the feed can hold
// kinds a slightly older app doesn't know yet; the Inbox and the bell skip those instead of crashing.
// `family_recap` is left out on purpose: the Inbox shows the weekly family recap as its own card
// (family_recaps(), dismissible); that row exists only to push (M5, owner 2026-10-04).
export const FEED_KINDS = [
  "group_check_in", "approval_needed", "check_in_approved", "check_in_rejected", "everyone_done",
  "group_streak_ended", "group_milestone", "group_habit_created", "group_habit_paused", "group_habit_resumed",
  "group_habit_archived", "member_paused", "member_joined", "member_left", "role_changed", "nudge", "cheer",
  "kid_check_in", "kid_streak", "kid_goal_reached", "kid_garden_full",
  "private_streak_ended", "daily_summary", "habit_reminder", "approval_expiring",
  "streak_back", "already_logged", "sync_dropped", "undo_dropped",
  "level_up", "badge_unlocked", "streak_milestone", "rest_day_used", "weekly_recap", "monthly_recap",
] as const;
type Kind = (typeof FEED_KINDS)[number];

export function isFeedKind(kind: string): kind is Kind {
  return (FEED_KINDS as readonly string[]).includes(kind);
}

const SCHEDULE_KEY: Record<PeriodUnit, string> = { day: "schedule.daily", week: "schedule.weekly", month: "schedule.monthly" };

const asOutcome = (o: unknown): copy.ApprovalOutcome | null => (o === "approved" || o === "rejected" || o === "expired" ? o : null);
// inbox_feed's subject_gender (the kid's profiles.gender): boy/girl pick the wording, anything else is neutral.
const asGender = (g: string | null): copy.KidGender => (g === "boy" || g === "girl" ? g : "other");
const asPeriod = (p: unknown, fallback: PeriodUnit): PeriodUnit => (p === "day" || p === "week" || p === "month" ? p : fallback);

export function feedCopy(t: T, locale: Locale, n: FeedItem): { title: string; body: string; href: string | null } {
  const group = n.group_name ?? t("push.fallback.group");
  const habit = n.habit_title ?? t("push.fallback.habit");
  const who = n.actor_name ?? t("push.fallback.someone");
  const kid = n.subject_name ?? t("push.fallback.child");
  const gender = asGender(n.subject_gender);
  const streak = Number(n.payload.streak ?? 0);
  const habitHref = n.habit_id ? `/habits/${n.habit_id}` : null;
  const groupHref = n.group_id ? `/groups/${n.group_id}` : null;
  const kidHref = n.subject_id ? `/kids/${n.subject_id}` : null;
  const outcome = asOutcome(n.payload.outcome);

  switch (n.kind) {
    case "group_check_in": return { ...copy.groupCheckIn(t, locale, group, [who], habit)!, href: habitHref };
    case "approval_needed":
      if (outcome) return { ...copy.approvalDecided(t, group, who, habit, outcome), href: habitHref };
      return { ...copy.approvalNeeded(t, group, [{ author: who, habit }])!, href: "/inbox" };
    case "check_in_approved": return { title: habit, body: t("feed.checkInApproved", { who: isolate(who) }), href: habitHref };
    case "check_in_rejected": return { ...copy.checkInNotApproved(t, habit, who, asPeriod(n.payload.period, "day")), href: habitHref };
    case "everyone_done": return { ...copy.everyoneDidIt(t, group, habit), href: habitHref };
    case "group_streak_ended": {
      // Copy sheet: streaks under 3 get no message. The feed row still exists, so keep the plain line for it.
      const period = asPeriod(n.payload.period, "day");
      const ended = copy.groupStreakEnded(t, group, habit, streak, period);
      if (ended) return { ...ended, href: habitHref };
      return { title: group, body: t("push.groupStreakEnded", { habit: isolate(habit), span: t(`units.${period}`, { n: streak }), period }), href: habitHref };
    }
    case "group_milestone": return { ...copy.groupMilestone(t, group, habit, streak, asPeriod(n.payload.period, "day")), href: habitHref };
    case "group_habit_created": {
      // The feed row carries period and target_count, not the full schedule: say "weekly" only for a once-a-period habit.
      const p = n.payload.period;
      if ((p === "day" || p === "week" || p === "month") && n.payload.target_count === 1) return { ...copy.groupHabitCreated(t, group, who, habit, t(SCHEDULE_KEY[p])), href: habitHref };
      return { title: group, body: t("feed.groupHabitAdded", { author: isolate(who), habit: isolate(habit) }), href: habitHref };
    }
    case "group_habit_paused": return { ...copy.groupHabitPaused(t, group, habit, n.payload.ends_on ? formatLocalDate(String(n.payload.ends_on), locale) : null), href: habitHref };
    case "group_habit_resumed": return { ...copy.groupHabitResumed(t, group, habit), href: habitHref };
    case "group_habit_archived": return { title: group, body: t("feed.habitArchived", { habit: isolate(habit) }), href: groupHref };
    case "member_paused": return { title: group, body: t("feed.memberPaused", { who: isolate(who), habit: isolate(habit) }), href: habitHref };
    case "member_joined": return { ...copy.memberJoined(t, group, who), href: groupHref };
    case "member_left": return { title: group, body: t(n.payload.removed ? "feed.memberRemoved" : "feed.memberLeft", { who: isolate(who), group: isolate(group) }), href: groupHref };
    case "role_changed": return { title: group, body: t(n.payload.role === "admin" ? "feed.roleAdmin" : "feed.roleMember", { group: isolate(group) }), href: groupHref };
    case "nudge": {
      const kind = NUDGE_KINDS.find((k) => k.kind === n.payload.kind)?.kind ?? "thinking_of_you";
      return { ...copy.nudge(t, kind, who, habit), href: habitHref };
    }
    case "cheer": return { title: habit, body: t("feed.cheer", { who: isolate(who) }), href: habitHref };
    case "kid_check_in":
      return { title: kid, body: n.actor_name ? t("feed.kidLoggedBy", { adult: isolate(who), habit: isolate(habit), kid: isolate(kid) }) : t("feed.kidDidIt", { gender, kid: isolate(kid), habit: isolate(habit) }), href: kidHref };
    case "kid_streak": return { ...copy.kidStreak(t, kid, streak, habit, gender), href: kidHref };
    case "kid_goal_reached": {
      const goal = copy.kidTreatGoal(t, kid, String(n.payload.title ?? ""), String(n.payload.emoji ?? ""), gender);
      return { ...goal, body: goal.body.trim(), href: kidHref };
    }
    case "kid_garden_full": return { ...copy.kidFullGarden(t, kid, gender), href: kidHref };
    case "private_streak_ended":
      return { ...copy.privateStreakEnded(t, habit, streak, asPeriod(n.payload.period, "day"), Number(n.payload.best ?? 0)), href: habitHref };
    case "daily_summary": {
      const rows = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
      const summary = copy.dailySummary(t, {
        todo: rows(n.payload.todo).map((r) => ({ title: String(r.title), done: Number(r.done ?? 0), target: Number(r.target ?? 1) })),
        atRisk: rows(n.payload.at_risk).map((r) => ({
          title: String(r.title), done: Number(r.done ?? 0), target: Number(r.target ?? 1),
          period: r.period === "month" ? "month" : "week", daysLeft: Number(r.days_left ?? 0),
        })),
      });
      return { ...(summary ?? copy.allDoneToday(t)), href: "/today" };
    }
    // A habit's own reminder has no group: the line names only the habit.
    case "habit_reminder": return { ...copy.habitReminder(t, habit), href: habitHref };
    case "approval_expiring":
      if (outcome) return { ...copy.approvalDecided(t, group, who, habit, outcome), href: habitHref };
      return { ...copy.approvalExpiring(t, group, who, habit), href: "/inbox" };
    // Offline sync notes (ideas/offline.md §4). A private habit's streak note has no group: the habit is the title.
    case "streak_back": return { ...copy.groupStreakBack(t, n.group_name ?? habit, habit), href: habitHref };
    case "already_logged": return { ...copy.alreadyLogged(t, kid, n.actor_name, habit, gender), href: kidHref ?? habitHref };
    case "sync_dropped": {
      // tapped_on is the habit's local date; read it as a plain date (UTC), so the weekday never shifts.
      const day = typeof n.payload.tapped_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(n.payload.tapped_on)
        ? new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "UTC", weekday: "short" }).format(new Date(`${n.payload.tapped_on}T00:00:00Z`))
        : t("feed.dayEarlier");
      return { ...copy.syncDropped(t, habit, day), href: habitHref };
    }
    case "undo_dropped": return { ...copy.undoDropped(t, habit, n.payload.reason === "approved" ? "approved" : "period_closed"), href: habitHref };
    // M5 (ideas/achievements-and-rewards.md): Inbox rows, pushed under Achievements (Inbox only by default).
    case "level_up": {
      const level = Number(n.payload.level ?? 1);
      return { ...copy.levelUp(t, level, levelName(level)), href: "/profile" };
    }
    case "badge_unlocked": return { ...copy.badgeUnlocked(t, badgeName(t, String(n.payload.code ?? ""), String(n.payload.name ?? t("push.fallback.badge")))), href: "/profile/achievements" };
    case "streak_milestone":
      return { ...copy.streakMilestone(t, habit, streak, asPeriod(n.payload.period, "day"), n.payload.back === true), href: habitHref };
    case "rest_day_used": return { ...copy.restDayUsed(t, habit, streak, n.payload.period === "week" ? "week" : "day"), href: habitHref };
    case "weekly_recap":
    case "monthly_recap":
      return { ...(copy.recapCopy(t, locale, n.payload) ?? { title: t(n.kind === "weekly_recap" ? "push.weeklyRecap.title" : "push.monthlyRecap.title"), body: t("feed.recapReady") }), href: "/progress/recaps" };
  }
}
