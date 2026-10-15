// lib/notification-copy.ts
// Every push and feed text, from ideas/notifications-tone.md (the copy sheet).
// Voice: warm, short, at most one emoji, never name who missed. The test runs these rules over every builder.
// The words live in the message catalog (_shared/messages); user values are direction-isolated.
import { INTL_LOCALE, isolate, type Locale, type T } from "./i18n.ts";
import type { LevelName } from "./levels.ts";

export type Copy = { title: string; body: string };
export type PeriodUnit = "day" | "week" | "month";
export type NudgeKind = "thinking_of_you" | "you_got_this" | "gentle_reminder";
export type SummaryItem = { title: string; done?: number; target?: number };
export type KidGender = "boy" | "girl" | "other";
export type AtRiskItem = { title: string; done: number; target: number; period: "week" | "month"; daysLeft: number };

export const BANNED_WORDS = ["failed", "missed out", "don't lose", "hurry", "last chance", "lazy", "you missed"] as const;
// "only X left" is a pattern: any number.
export const BANNED_PATTERNS: readonly RegExp[] = [/only \d+ left/i];

const span = (t: T, n: number, unit: PeriodUnit) => t(`units.${unit}`, { n });

// "Anna", "Anna and Dan", "Anna, Dan and Grandma", "Anna, Dan and 3 others".
export function joinNames(t: T, locale: Locale, names: string[]): string {
  const list = names.length > 3 ? [names[0], names[1], t("push.others", { n: names.length - 2 })] : names;
  return new Intl.ListFormat(INTL_LOCALE[locale], { type: "conjunction" }).format(list);
}

export function dailySummary(t: T, { todo, atRisk }: { todo: SummaryItem[]; atRisk: AtRiskItem[] }): Copy | null {
  if (todo.length === 0 && atRisk.length === 0) return null;
  const parts = [
    todo.map((i) => (i.target && i.target > 1 ? `${isolate(i.title)} ${i.done ?? 0}/${i.target}` : isolate(i.title))).join(", "),
    atRisk
      .map((r) => t("push.dailySummary.atRisk", { habit: isolate(r.title), done: String(r.done), target: String(r.target), period: r.period, days: span(t, r.daysLeft, "day") }))
      .join(", "),
  ].filter(Boolean);
  return { title: t("push.today"), body: t("push.dailySummary.body", { items: parts.join(" · ") }) };
}

// The Inbox line for a daily summary row with nothing left to do (the push is skipped then).
export const allDoneToday = (t: T): Copy => ({ title: t("push.today"), body: t("push.allDoneToday") });

export const habitReminder = (t: T, habit: string): Copy => ({ title: habit, body: t("push.habitReminder", { habit: isolate(habit) }) });

export function groupCheckIn(t: T, locale: Locale, group: string, names: string[], habit: string): Copy | null {
  if (names.length === 0) return null;
  return { title: group, body: t("push.groupCheckIn", { names: joinNames(t, locale, names.map(isolate)), habit: isolate(habit) }) };
}

export const everyoneDidIt = (t: T, group: string, habit: string): Copy => ({
  title: group,
  body: t("push.everyoneDidIt", { habit: isolate(habit) }),
});

export function approvalNeeded(t: T, group: string, pending: { author: string; habit: string }[]): Copy | null {
  if (pending.length === 0) return null;
  if (pending.length === 1) {
    return { title: group, body: t("push.approvalNeeded.one", { author: isolate(pending[0].author), habit: isolate(pending[0].habit) }) };
  }
  return { title: group, body: t("push.approvalNeeded.many", { n: pending.length }) };
}

export const approvalExpiring = (t: T, group: string, author: string, habit: string): Copy => ({
  title: group,
  body: t("push.approvalExpiring", { author: isolate(author), habit: isolate(habit) }),
});

// A decided "Approve?" row in the Inbox (the database stamps the outcome when the check-in leaves pending).
export type ApprovalOutcome = "approved" | "rejected" | "expired";
export const approvalDecided = (t: T, group: string, author: string, habit: string, outcome: ApprovalOutcome): Copy => ({
  title: group,
  body: t("push.approvalDecided", { author: isolate(author), habit: isolate(habit), outcome }),
});

export const checkInNotApproved = (t: T, habit: string, reviewer: string, period: PeriodUnit): Copy => ({
  title: habit,
  body: t("push.checkInNotApproved", { reviewer: isolate(reviewer), period }),
});

export const nudge = (t: T, kind: NudgeKind, sender: string, habit: string): Copy => ({
  title: habit,
  body: t("push.nudge", { kind, sender: isolate(sender), habit: isolate(habit) }),
});

export function groupStreakEnded(t: T, group: string, habit: string, length: number, period: PeriodUnit): Copy | null {
  if (length < 3) return null;
  return { title: group, body: t("push.groupStreakEnded", { habit: isolate(habit), span: span(t, length, period), period }) };
}

// Feed only (ideas/achievements-and-rewards.md §5): "Read streak ended at 12 days. Your best is still 21."
export function privateStreakEnded(t: T, habit: string, length: number, period: PeriodUnit, best: number): Copy {
  const values = { habit: isolate(habit), span: span(t, length, period) };
  return {
    title: habit,
    body: best > length
      ? t("push.privateStreakEnded.best", { ...values, best: String(best) })
      : t("push.privateStreakEnded.restart", { ...values, period }),
  };
}

export const groupStreakBack = (t: T, group: string, habit: string): Copy => ({
  title: group,
  body: t("push.groupStreakBack", { habit: isolate(habit) }),
});

export const groupHabitCreated = (t: T, group: string, author: string, habit: string, schedule: string): Copy => ({
  title: group,
  body: t("push.groupHabitCreated", { author: isolate(author), habit: isolate(habit), schedule }),
});

export const groupHabitPaused = (t: T, group: string, habit: string, untilLabel: string | null): Copy => ({
  title: group,
  body: untilLabel
    ? t("push.groupHabitPaused.until", { habit: isolate(habit), until: untilLabel })
    : t("push.groupHabitPaused.open", { habit: isolate(habit) }),
});

export const groupHabitResumed = (t: T, group: string, habit: string): Copy => ({
  title: group,
  body: t("push.groupHabitResumed", { habit: isolate(habit) }),
});

export const memberJoined = (t: T, group: string, member: string): Copy => ({
  title: group,
  body: t("push.memberJoined", { member: isolate(member), group: isolate(group) }),
});

export const restDayUsed = (t: T, habit: string, streakLength: number, period: "day" | "week"): Copy => ({
  title: habit,
  body: t("push.restDayUsed", { period, n: String(streakLength) }),
});

type RecapStreak = { habit: string; length: number; period?: PeriodUnit };
const longestLine = (t: T, l: RecapStreak) => t("push.longestStreak", { habit: isolate(l.habit), span: span(t, l.length, l.period ?? "day") });

// `context`: the Inbox row and push say "last week"; Progress → Recaps lists the week under its own
// date, so its line is just the count.
export function weeklyRecap(
  t: T,
  { done, possible, longest }: { done: number; possible: number; longest: RecapStreak | null },
  context: "inbox" | "history" = "inbox",
): Copy | null {
  if (possible === 0) return null;
  const base = t(context === "history" ? "push.weeklyRecap.history" : "push.weeklyRecap.inbox", { done: String(done), possible });
  return { title: t("push.weeklyRecap.title"), body: longest ? `${base} ${longestLine(t, longest)}` : base };
}

// One emoji per stage of the growth path (levels.ts codes), so a Forest level-up doesn't say 🌱.
const LEVEL_EMOJI: Record<LevelName, string> = { Seedling: "🌱", Sprout: "🌿", Sapling: "🪴", Tree: "🌲", Forest: "🌳" };

export const levelUp = (t: T, level: number, code: LevelName): Copy => ({
  title: t("push.levelUp", { level: String(level) }),
  body: `${t(`levels.${code}`)} ${LEVEL_EMOJI[code] ?? "🌱"}`,
});

export const badgeUnlocked = (t: T, badgeName: string): Copy => ({ title: t("push.badgeUnlocked"), body: badgeName });

// A group habit's streak milestone (Inbox row and push under Group updates; owner 2026-10-04: no group
// cards on Today). Same words as its Inbox row (lib/feed-copy.ts).
export const groupMilestone = (t: T, group: string, habit: string, length: number, period: PeriodUnit): Copy => ({
  title: group,
  body: t("push.groupMilestone", { habit: isolate(habit), span: span(t, length, period) }),
});

export const milestoneCard = (t: T, habit: string, length: number, period: PeriodUnit): string =>
  t("push.milestoneCard", { habit: isolate(habit), span: span(t, length, period) });

// A personal streak milestone (Inbox row and push under Achievements; owner 2026-10-04: no cards on
// Today). `back`: this habit reached this length before, in an earlier streak.
export function streakMilestone(t: T, habit: string, length: number, period: PeriodUnit, back: boolean): Copy {
  const h = isolate(habit);
  if (length === 1) return { title: habit, body: back ? t("push.streakMilestone.fresh", { habit: h }) : t("push.streakMilestone.first", { habit: h, period }) };
  if (length === 2 && period === "day") return { title: habit, body: t(back ? "push.streakMilestone.day2Again" : "push.streakMilestone.day2") };
  if (back) return { title: habit, body: t("push.streakMilestone.back", { habit: h, span: span(t, length, period) }) };
  return { title: habit, body: milestoneCard(t, habit, length, period) };
}

export function monthlyRecap(
  t: T,
  { month, done, possible, longest }: { month: string; done: number; possible: number; longest: RecapStreak | null },
): Copy | null {
  if (possible === 0) return null;
  const base = t("push.monthlyRecap.body", { done: String(done), possible, month });
  return { title: t("push.monthlyRecap.title"), body: longest ? `${base} ${longestLine(t, longest)}` : base };
}

// The weekly family recap's push (owner 2026-10-04: an Inbox card plus a push). Same words as the card
// (lib/today-cards.ts recapLine).
export function familyRecap(t: T, group: string, checkIns: number, best: { habit: string; length: number; period: PeriodUnit } | null): Copy | null {
  if (checkIns <= 0) return null;
  return {
    title: group,
    body: best
      ? t("push.familyRecap.best", { n: checkIns, habit: isolate(best.habit), span: span(t, best.length, best.period) })
      : t("push.familyRecap.plain", { n: checkIns }),
  };
}

const PERIOD_UNITS = new Set(["day", "week", "month"]);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const count = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);

// "2026-09-01" → "September" (a plain date, read in UTC so the month never shifts).
function monthOf(t: T, locale: Locale, iso: unknown): string {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return t("push.monthlyRecap.lastMonth");
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "UTC", month: "long" }).format(new Date(`${iso}T00:00:00Z`));
}

// A weekly or monthly recap row's payload (private.recap_impl) → its text. null when it's malformed or empty.
export function recapCopy(t: T, locale: Locale, payload: Record<string, unknown>, context: "inbox" | "history" = "inbox"): Copy | null {
  const done = count(payload.done);
  const possible = count(payload.possible);
  if (done === null || possible === null) return null;
  const l = isRecord(payload.longest) ? payload.longest : null;
  const longest = l && typeof l.title === "string" && count(l.length) ? { habit: l.title, length: count(l.length)!, period: PERIOD_UNITS.has(String(l.period)) ? (String(l.period) as PeriodUnit) : "day" } : null;
  return payload.kind === "month"
    ? monthlyRecap(t, { month: monthOf(t, locale, payload.start), done, possible, longest })
    : weeklyRecap(t, { done, possible, longest }, context);
}

export function familyRecapCopy(t: T, group: string, payload: Record<string, unknown>): Copy | null {
  const b = isRecord(payload.best) ? payload.best : null;
  const best = b && typeof b.title === "string" && count(b.length) && PERIOD_UNITS.has(String(b.period))
    ? { habit: b.title, length: count(b.length)!, period: String(b.period) as PeriodUnit }
    : null;
  return familyRecap(t, group, count(payload.check_ins) ?? 0, best);
}

// Kid moments: `gender` picks the wording where a language needs it ("other" = neutral).
export const kidTreatGoal = (t: T, kid: string, goal: string, goalEmoji: string, gender: KidGender = "other"): Copy => ({
  title: kid,
  body: t("push.kidTreatGoal", { gender, kid: isolate(kid), goal: goal ? isolate(goal) : "", emoji: goalEmoji }).trim(),
});

export const kidFullGarden = (t: T, kid: string, gender: KidGender = "other"): Copy => ({
  title: kid,
  body: t("push.kidFullGarden", { gender, kid: isolate(kid) }),
});

export const kidStreak = (t: T, kid: string, length: number, habit: string, gender: KidGender = "other"): Copy => ({
  title: kid,
  body: t("push.kidStreak", { gender, kid: isolate(kid), span: span(t, length, "day"), habit: isolate(habit) }),
});

// Offline sync notes (ideas/offline.md §4), feed only. `day` is the tap's weekday ("Mon"), or "earlier".
export const alreadyLogged = (t: T, kid: string, adult: string | null, habit: string, gender: KidGender = "other"): Copy => ({
  title: kid,
  body: adult
    ? t("push.alreadyLogged.byAdult", { adult: isolate(adult), habit: isolate(habit), kid: isolate(kid) })
    : t("push.alreadyLogged.byKid", { gender, kid: isolate(kid), habit: isolate(habit) }),
});

export const syncDropped = (t: T, habit: string, day: string): Copy => ({
  title: habit,
  body: t("push.syncDropped", { day }),
});

export const undoDropped = (t: T, habit: string, reason: "approved" | "period_closed"): Copy => ({
  title: habit,
  body: t(reason === "approved" ? "push.undoDropped.approved" : "push.undoDropped.periodClosed", { habit: isolate(habit) }),
});
