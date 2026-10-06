// lib/notification-copy.ts
// Every push and feed text, from ideas/notifications-tone.md (the copy sheet).
// Voice: warm, short, at most one emoji, never name who missed. The test runs these rules over every builder.

export type Copy = { title: string; body: string };
export type PeriodUnit = "day" | "week" | "month";
export type NudgeKind = "thinking_of_you" | "you_got_this" | "gentle_reminder";
export type SummaryItem = { title: string; done?: number; target?: number };
export type AtRiskItem = { title: string; done: number; target: number; period: "week" | "month"; daysLeft: number };

export const BANNED_WORDS = ["failed", "missed out", "don't lose", "hurry", "last chance", "lazy", "you missed"] as const;
// "only X left" is a pattern: any number.
export const BANNED_PATTERNS: readonly RegExp[] = [/only \d+ left/i];

const THIS: Record<PeriodUnit, string> = { day: "today", week: "this week", month: "this month" };

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} others`;
}

export function dailySummary({ todo, atRisk }: { todo: SummaryItem[]; atRisk: AtRiskItem[] }): Copy | null {
  if (todo.length === 0 && atRisk.length === 0) return null;
  const parts = [
    todo.map((t) => (t.target && t.target > 1 ? `${t.title} ${t.done ?? 0}/${t.target}` : t.title)).join(", "),
    atRisk.map((r) => `${r.title}: ${r.done} of ${r.target} ${THIS[r.period]}, ${plural(r.daysLeft, "day")} left`).join(", "),
  ].filter(Boolean);
  return { title: "Today", body: `Still to do: ${parts.join(" · ")} 🌱` };
}

// The Inbox line for a daily summary row with nothing left to do (the push is skipped then).
export const allDoneToday: Copy = { title: "Today", body: "All done for today 🎉" };

export const habitReminder = (habit: string): Copy => ({ title: habit, body: `Time for ${habit}.` });

export function groupCheckIn(group: string, names: string[], habit: string): Copy | null {
  if (names.length === 0) return null;
  return { title: group, body: `${joinNames(names)} checked in: ${habit}` };
}

export const everyoneDidIt = (group: string, habit: string): Copy => ({ title: group, body: `Everyone did it: ${habit} ✓` });

export function approvalNeeded(group: string, pending: { author: string; habit: string }[]): Copy | null {
  if (pending.length === 0) return null;
  if (pending.length === 1) return { title: group, body: `${pending[0].author} did ${pending[0].habit}. Approve?` };
  return { title: group, body: `${pending.length} check-ins waiting for you` };
}

export const approvalExpiring = (group: string, author: string, habit: string): Copy => ({
  title: group,
  body: `${author}'s ${habit} check-in needs a yes within 2 hours`,
});

export const checkInNotApproved = (habit: string, reviewer: string, period: PeriodUnit): Copy => ({
  title: habit,
  body: `${reviewer} didn't approve your check-in. You can check in again ${THIS[period]}.`,
});

const NUDGE: Record<NudgeKind, (sender: string, habit: string) => string> = {
  thinking_of_you: (s, h) => `${s}: Thinking of you. ${h} today?`,
  you_got_this: (s, h) => `${s}: You've got this: ${h}`,
  gentle_reminder: (s, h) => `${s}: Gentle reminder: ${h}`,
};

export const nudge = (kind: NudgeKind, sender: string, habit: string): Copy => ({ title: habit, body: NUDGE[kind](sender, habit) });

export function groupStreakEnded(group: string, habit: string, length: number, period: PeriodUnit): Copy | null {
  if (length < 3) return null;
  return { title: group, body: `${habit} streak ended at ${plural(length, period)}. Start a new one ${THIS[period]}.` };
}

// Feed only (ideas/achievements-and-rewards.md §5): "Read streak ended at 12 days. Your best is still 21."
export function privateStreakEnded(habit: string, length: number, period: PeriodUnit, best: number): Copy {
  const ended = `${habit} streak ended at ${plural(length, period)}.`;
  return { title: habit, body: best > length ? `${ended} Your best is still ${best}.` : `${ended} Start a new one ${THIS[period]}.` };
}

export const groupStreakBack = (group: string, habit: string): Copy => ({
  title: group,
  body: `A late check-in arrived. ${habit} streak is back 🔥`,
});

export const groupHabitCreated = (group: string, author: string, habit: string, schedule: string): Copy => ({
  title: group,
  body: `${author} added ${habit}, ${schedule}.`,
});

export const groupHabitPaused = (group: string, habit: string, untilLabel: string | null): Copy => ({
  title: group,
  body: untilLabel ? `${habit} is paused until ${untilLabel}.` : `${habit} is paused.`,
});

export const groupHabitResumed = (group: string, habit: string): Copy => ({ title: group, body: `${habit} is back.` });

export const memberJoined = (group: string, member: string): Copy => ({ title: group, body: `${member} joined ${group} 👋` });

export const restDayUsed = (habit: string, streakLength: number, period: "day" | "week"): Copy => ({
  title: habit,
  body: `Rest ${period} used. Your ${streakLength}-${period} streak is safe 💤`,
});

type RecapStreak = { habit: string; length: number; period?: PeriodUnit };
const longestLine = (l: RecapStreak) => `Longest streak: ${l.habit} 🔥 ${plural(l.length, l.period ?? "day")}`;

// `context`: the Inbox row and push say "last week"; Progress → Recaps lists the week under its own
// date, so its line is just the count.
export function weeklyRecap(
  { done, possible, longest }: { done: number; possible: number; longest: RecapStreak | null },
  context: "inbox" | "history" = "inbox",
): Copy | null {
  if (possible === 0) return null;
  const base = `${done} of ${plural(possible, "check-in")}${context === "history" ? "" : " last week"}.`;
  return { title: "Your week", body: longest ? `${base} ${longestLine(longest)}` : base };
}

export const levelUp = (level: number, levelName: string): Copy => ({ title: `Level ${level}`, body: `${levelName} 🌱` });

export const badgeUnlocked = (badgeName: string): Copy => ({ title: "Unlocked", body: badgeName });

// A group habit's streak milestone (Inbox row and push under Group updates; owner 2026-10-04: no group
// cards on Today). Same words as its Inbox row (lib/feed-copy.ts).
export const groupMilestone = (group: string, habit: string, length: number, period: PeriodUnit): Copy => ({
  title: group,
  body: `🔥 ${habit}: ${plural(length, period)} in a row, together`,
});

export const milestoneCard = (habit: string, length: number, period: PeriodUnit): string =>
  `🔥 ${habit}: ${plural(length, period)} in a row`;

// A personal streak milestone (Inbox row and push under Achievements; owner 2026-10-04: no cards on
// Today). `back`: this habit reached this length before, in an earlier streak.
export function streakMilestone(habit: string, length: number, period: PeriodUnit, back: boolean): Copy {
  if (length === 1) return { title: habit, body: back ? `A fresh start: ${habit} ✨` : `First ${period} of ${habit} ✨` };
  if (length === 2 && period === "day") return { title: habit, body: back ? "Day 2 in a row again 🌱" : "Day 2 in a row. Nice start 🌱" };
  if (back) return { title: habit, body: `Back to ${plural(length, period)} of ${habit} 🔥` };
  return { title: habit, body: milestoneCard(habit, length, period) };
}

export function monthlyRecap({ month, done, possible, longest }: { month: string; done: number; possible: number; longest: RecapStreak | null }): Copy | null {
  if (possible === 0) return null;
  const base = `${done} of ${plural(possible, "check-in")} in ${month}.`;
  return { title: "Your month", body: longest ? `${base} ${longestLine(longest)}` : base };
}

// The weekly family recap's push (owner 2026-10-04: an Inbox card plus a push). Same words as the card
// (lib/today-cards.ts recapLine).
export function familyRecap(group: string, checkIns: number, best: { habit: string; length: number; period: PeriodUnit } | null): Copy | null {
  if (checkIns <= 0) return null;
  const base = `Together last week: ${plural(checkIns, "check-in")}`;
  return { title: group, body: best ? `${base} · ${best.habit} ${plural(best.length, best.period)} 🔥` : base };
}

const PERIOD_UNITS = new Set(["day", "week", "month"]);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const count = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);

// "2026-09-01" → "September" (a plain date, read in UTC so the month never shifts).
function monthOf(iso: unknown): string {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "the last month";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long" }).format(new Date(`${iso}T00:00:00Z`));
}

// A weekly or monthly recap row's payload (private.recap_impl) → its text. null when it's malformed or empty.
export function recapCopy(payload: Record<string, unknown>, context: "inbox" | "history" = "inbox"): Copy | null {
  const done = count(payload.done);
  const possible = count(payload.possible);
  if (done === null || possible === null) return null;
  const l = isRecord(payload.longest) ? payload.longest : null;
  const longest = l && typeof l.title === "string" && count(l.length) ? { habit: l.title, length: count(l.length)!, period: PERIOD_UNITS.has(String(l.period)) ? (String(l.period) as PeriodUnit) : "day" } : null;
  return payload.kind === "month"
    ? monthlyRecap({ month: monthOf(payload.start), done, possible, longest })
    : weeklyRecap({ done, possible, longest }, context);
}

export function familyRecapCopy(group: string, payload: Record<string, unknown>): Copy | null {
  const b = isRecord(payload.best) ? payload.best : null;
  const best = b && typeof b.title === "string" && count(b.length) && PERIOD_UNITS.has(String(b.period))
    ? { habit: b.title, length: count(b.length)!, period: String(b.period) as PeriodUnit }
    : null;
  return familyRecap(group, count(payload.check_ins) ?? 0, best);
}

export const kidTreatGoal = (kid: string, goal: string, goalEmoji: string): Copy => ({
  title: kid,
  body: `${kid} reached a goal: ${goal} ${goalEmoji}`.trim(),
});

export const kidFullGarden = (kid: string): Copy => ({ title: kid, body: `${kid}'s garden is in full bloom this week 🌷` });

export const kidStreak = (kid: string, length: number, habit: string): Copy => ({
  title: kid,
  body: `${kid}: ${plural(length, "day")} in a row: ${habit} 🔥`,
});

// Offline sync notes (ideas/offline.md §4), feed only. `day` is the tap's weekday ("Mon"), or "earlier".
export const alreadyLogged = (kid: string, adult: string | null, habit: string): Copy => ({
  title: kid,
  body: adult ? `${adult} already logged ${habit} for ${kid} ✓` : `${kid} already did ${habit} ✓`,
});

export const syncDropped = (habit: string, day: string): Copy => ({
  title: habit,
  body: `A check-in from ${day} couldn't count: it was more than 3 days old when it synced.`,
});

export const undoDropped = (habit: string, reason: "approved" | "period_closed"): Copy => ({
  title: habit,
  body: reason === "approved" ? `Couldn't undo ${habit}, it was already approved.` : `Couldn't undo ${habit}, its time has passed.`,
});
