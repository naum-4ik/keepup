// supabase/functions/send-push/build.ts
// One feed row → one notification payload. Pure: send-push's handler and tests call it.
import * as copy from "../_shared/notification-copy.ts";
import { levelName } from "../_shared/levels.ts";
import { badgeName, TEMPLATE_IDS } from "./i18n.ts";
import { habitNamer, namedPayload } from "../_shared/habit-title.ts";
import { INTL_LOCALE, type Locale, type T } from "../_shared/i18n.ts";

export type PushJob = {
  id: string;
  kind: string;
  user_id: string;
  pushed: boolean;
  group_id: string | null;
  group: string | null;
  habit_id: string | null;
  habit: string | null;
  // habits.template_id: a template habit's name is shown in the recipient's language. Absent on an
  // older push_job: the stored title.
  habit_template?: string | null;
  period: string | null;
  target: number | null;
  check_in_id: string | null;
  check_in_status: string | null;
  actor: string | null;
  subject_id: string | null;
  subject: string | null;
  payload: Record<string, unknown>;
  names: string[];
  pending: { check_in_id: string; author: string; habit: string; habit_template?: string | null }[];
  subscriptions: { endpoint: string; p256dh: string; auth: string }[];
  // The person's delivery for this category: anything but Sound is silent. Absent (an older push_job)
  // means silent too: fail to quiet.
  silent?: boolean;
  // The recipient's language (profiles.locale) and, for kid kinds, the child's gender. Absent on an
  // older push_job: English and neutral wording.
  locale?: string;
  subject_gender?: "boy" | "girl" | null;
};

export type PushPayload = {
  title: string;
  body: string;
  tag: string;
  url: string;
  actions: { action: "approve" | "reject"; title: string }[];
  checkInId: string | null;
  // Web Push `silent`: honoured by Android Chrome and desktop browsers. iPhone Safari ignores it; there,
  // sound is one switch per app (Settings → Notifications → Keepup → Sounds).
  silent: boolean;
};

const PERIODS = new Set(["day", "week", "month"]);
const period = (v: unknown): copy.PeriodUnit => (PERIODS.has(String(v)) ? (String(v) as copy.PeriodUnit) : "day");
const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const NUDGES = new Set(["thinking_of_you", "you_got_this", "gentle_reminder"]);
const nudgeKind = (v: unknown): copy.NudgeKind => (NUDGES.has(String(v)) ? (String(v) as copy.NudgeKind) : "thinking_of_you");

// "weekly", "3× a week" (lib/schedule.ts describeSchedule, lower-cased for the sentence).
function scheduleLabel(t: T, target: unknown, p: unknown): string {
  const unit = period(p);
  if (num(target) <= 1) return t({ day: "schedule.daily", week: "schedule.weekly", month: "schedule.monthly" }[unit]);
  return t("schedule.timesPer", { n: String(num(target)), unit });
}

// "2026-10-12" → "Mon 12 Oct".
function dayLabel(locale: Locale, iso: unknown): string | null {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" })
    .format(new Date(Date.UTC(y, m - 1, d)))
    .replace(",", "");
}

type Row = Record<string, unknown>;
const rows = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : []);

function copyFor(raw: PushJob, t: T, locale: Locale): copy.Copy | null {
  // Template habits by the recipient's language: the habit, the pending list and the payload's rows.
  const name = habitNamer(t, TEMPLATE_IDS);
  const job: PushJob = {
    ...raw,
    pending: raw.pending.map((p) => ({ ...p, habit: name(p.habit, p.habit_template) })),
    payload: namedPayload(raw.payload, name),
  };
  const group = job.group ?? t("push.fallback.group");
  const habit = job.habit == null ? t("push.fallback.habit") : name(job.habit, job.habit_template);
  const who = job.actor ?? t("push.fallback.someone");
  const kid = job.subject ?? t("push.fallback.child");
  const gender = job.subject_gender ?? "other";
  switch (job.kind) {
    case "nudge": return copy.nudge(t, nudgeKind(job.payload.kind), who, habit);
    case "check_in_rejected": return copy.checkInNotApproved(t, habit, who, period(job.period));
    case "group_check_in": return copy.groupCheckIn(t, locale, group, job.names.length > 0 ? job.names : [who], habit);
    case "everyone_done": return copy.everyoneDidIt(t, group, habit);
    case "approval_needed": return job.pending.length > 0 ? copy.approvalNeeded(t, group, job.pending) : null;
    case "approval_expiring": return job.check_in_status === "pending" ? copy.approvalExpiring(t, group, who, habit) : null;
    case "daily_summary":
      return copy.dailySummary(t, {
        todo: rows(job.payload.todo).map((r) => ({ title: String(r.title), done: num(r.done), target: num(r.target) })),
        atRisk: rows(job.payload.at_risk).map((r) => ({
          title: String(r.title), done: num(r.done), target: num(r.target),
          period: r.period === "month" ? "month" : "week", daysLeft: num(r.days_left),
        })),
      });
    case "habit_reminder": return copy.habitReminder(t, habit);
    case "group_streak_ended": return copy.groupStreakEnded(t, group, habit, num(job.payload.streak), period(job.payload.period));
    case "streak_back": return copy.groupStreakBack(t, group, habit);
    case "group_milestone": return copy.groupMilestone(t, group, habit, num(job.payload.streak), period(job.payload.period));
    case "group_habit_created": return copy.groupHabitCreated(t, group, who, habit, scheduleLabel(t, job.payload.target_count, job.payload.period));
    case "group_habit_paused": return copy.groupHabitPaused(t, group, habit, dayLabel(locale, job.payload.ends_on));
    case "group_habit_resumed": return copy.groupHabitResumed(t, group, habit);
    case "member_joined": return copy.memberJoined(t, group, who);
    case "kid_goal_reached": return copy.kidTreatGoal(t, kid, String(job.payload.title ?? ""), String(job.payload.emoji ?? ""), gender);
    case "kid_garden_full": return copy.kidFullGarden(t, kid, gender);
    case "kid_streak": return copy.kidStreak(t, kid, num(job.payload.streak), habit, gender);
    case "level_up": return copy.levelUp(t, num(job.payload.level), levelName(num(job.payload.level)));
    case "badge_unlocked": return copy.badgeUnlocked(t, badgeName(t, String(job.payload.code ?? ""), String(job.payload.name ?? t("push.fallback.badge"))));
    case "streak_milestone": return copy.streakMilestone(t, habit, num(job.payload.streak), period(job.payload.period), job.payload.back === true);
    case "rest_day_used": return copy.restDayUsed(t, habit, num(job.payload.streak), job.payload.period === "week" ? "week" : "day");
    case "weekly_recap":
    case "monthly_recap": return copy.recapCopy(t, locale, job.payload);
    case "family_recap": return copy.familyRecapCopy(t, group, job.payload);
    default: return null;
  }
}

function tagFor(job: PushJob): string {
  if (job.kind === "group_check_in" || job.kind === "everyone_done" || job.kind === "group_milestone") return `habit:${job.habit_id}`;
  if (job.kind === "approval_needed" || job.kind === "approval_expiring") return "approvals";
  if (job.kind === "daily_summary") return "reminder";
  if (job.kind === "habit_reminder") return `reminder:${job.habit_id}`;
  return `${job.kind}:${job.id}`;
}

function urlFor(job: PushJob): string {
  if (job.kind === "level_up") return "/profile";
  if (job.kind === "badge_unlocked") return "/profile/achievements";
  if (job.kind === "weekly_recap" || job.kind === "monthly_recap") return "/progress/recaps";
  if (job.kind === "family_recap") return "/inbox";
  if (job.kind === "approval_needed" || job.kind === "approval_expiring") return "/inbox";
  if (job.kind === "daily_summary") return "/today";
  if (job.kind.startsWith("kid_") && job.subject_id) return `/kids/${job.subject_id}`;
  if (job.kind === "member_joined" && job.group_id) return `/groups/${job.group_id}`;
  if (job.habit_id) return `/habits/${job.habit_id}`;
  return "/inbox";
}

export function buildPush(job: PushJob, t: T, locale: Locale = "en"): PushPayload | null {
  const text = copyFor(job, t, locale);
  if (!text) return null;
  const single = job.kind === "approval_needed" && job.pending.length === 1 ? job.pending[0].check_in_id : null;
  return {
    ...text,
    tag: tagFor(job),
    url: urlFor(job),
    actions: single ? [{ action: "approve", title: t("push.actions.approve") }, { action: "reject", title: t("push.actions.reject") }] : [],
    checkInId: single,
    silent: job.silent !== false,
  };
}
