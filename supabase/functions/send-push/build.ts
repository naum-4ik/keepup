// supabase/functions/send-push/build.ts
// One feed row → one notification payload. Pure: send-push's handler and tests call it.
import * as copy from "../_shared/notification-copy.ts";

export type PushJob = {
  id: string;
  kind: string;
  user_id: string;
  pushed: boolean;
  group_id: string | null;
  group: string | null;
  habit_id: string | null;
  habit: string | null;
  period: string | null;
  target: number | null;
  check_in_id: string | null;
  check_in_status: string | null;
  actor: string | null;
  subject_id: string | null;
  subject: string | null;
  payload: Record<string, unknown>;
  names: string[];
  pending: { check_in_id: string; author: string; habit: string }[];
  subscriptions: { endpoint: string; p256dh: string; auth: string }[];
  // The person's delivery for this category: anything but Sound is silent. Absent (an older push_job)
  // means silent too: fail to quiet.
  silent?: boolean;
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
function scheduleLabel(target: unknown, p: unknown): string {
  const unit = period(p);
  if (num(target) <= 1) return { day: "daily", week: "weekly", month: "monthly" }[unit];
  return `${num(target)}× a ${unit}`;
}

// "2026-10-12" → "Mon 12 Oct".
function dayLabel(iso: unknown): string | null {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" })
    .format(new Date(Date.UTC(y, m - 1, d)))
    .replace(",", "");
}

type Row = Record<string, unknown>;
const rows = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : []);

function copyFor(job: PushJob): copy.Copy | null {
  const group = job.group ?? "Your group";
  const habit = job.habit ?? "a habit";
  const who = job.actor ?? "Someone";
  const kid = job.subject ?? "Your child";
  switch (job.kind) {
    case "nudge": return copy.nudge(nudgeKind(job.payload.kind), who, habit);
    case "check_in_rejected": return copy.checkInNotApproved(habit, who, period(job.period));
    case "group_check_in": return copy.groupCheckIn(group, job.names.length > 0 ? job.names : [who], habit);
    case "everyone_done": return copy.everyoneDidIt(group, habit);
    case "approval_needed": return job.pending.length > 0 ? copy.approvalNeeded(group, job.pending) : null;
    case "approval_expiring": return job.check_in_status === "pending" ? copy.approvalExpiring(group, who, habit) : null;
    case "daily_summary":
      return copy.dailySummary({
        todo: rows(job.payload.todo).map((r) => ({ title: String(r.title), done: num(r.done), target: num(r.target) })),
        atRisk: rows(job.payload.at_risk).map((r) => ({
          title: String(r.title), done: num(r.done), target: num(r.target),
          period: r.period === "month" ? "month" : "week", daysLeft: num(r.days_left),
        })),
      });
    case "habit_reminder": return copy.habitReminder(habit);
    case "group_streak_ended": return copy.groupStreakEnded(group, habit, num(job.payload.streak), period(job.payload.period));
    case "streak_back": return copy.groupStreakBack(group, habit);
    case "group_milestone": return copy.groupMilestone(group, habit, num(job.payload.streak), period(job.payload.period));
    case "group_habit_created": return copy.groupHabitCreated(group, who, habit, scheduleLabel(job.payload.target_count, job.payload.period));
    case "group_habit_paused": return copy.groupHabitPaused(group, habit, dayLabel(job.payload.ends_on));
    case "group_habit_resumed": return copy.groupHabitResumed(group, habit);
    case "member_joined": return copy.memberJoined(group, who);
    case "kid_goal_reached": return copy.kidTreatGoal(kid, String(job.payload.title ?? ""), String(job.payload.emoji ?? ""));
    case "kid_garden_full": return copy.kidFullGarden(kid);
    case "kid_streak": return copy.kidStreak(kid, num(job.payload.streak), habit);
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
  if (job.kind === "approval_needed" || job.kind === "approval_expiring") return "/inbox";
  if (job.kind === "daily_summary") return "/today";
  if (job.kind.startsWith("kid_") && job.subject_id) return `/kids/${job.subject_id}`;
  if (job.kind === "member_joined" && job.group_id) return `/groups/${job.group_id}`;
  if (job.habit_id) return `/habits/${job.habit_id}`;
  return "/inbox";
}

export function buildPush(job: PushJob): PushPayload | null {
  const text = copyFor(job);
  if (!text) return null;
  const single = job.kind === "approval_needed" && job.pending.length === 1 ? job.pending[0].check_in_id : null;
  return {
    ...text,
    tag: tagFor(job),
    url: urlFor(job),
    actions: single ? [{ action: "approve", title: "Approve" }, { action: "reject", title: "Don't approve" }] : [],
    checkInId: single,
    silent: job.silent !== false,
  };
}
