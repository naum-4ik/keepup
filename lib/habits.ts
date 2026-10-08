import "server-only";
import type { CalendarCell } from "@/lib/calendar";
import { requireUser } from "@/lib/auth";
import type { DayCheckIn } from "@/lib/day-detail";
import { habitEmoji, normalizeCategory } from "@/lib/categories";
import type { Database } from "@/lib/database.types";
import type { HabitCategory } from "@/lib/habit-schema";
import type { TapRow } from "@/lib/rendered-taps";
import { getChildSummaries, getMyChildren } from "@/lib/kids";
import { withTodayPending, type WeekOverview } from "@/lib/week-overview";
import { logError } from "@/lib/log";

// Kid habits (child_summaries) have no category; adult habits always have one.
export type HabitSummary = Omit<Database["public"]["Functions"]["habit_summaries"]["Returns"][number], "category"> & {
  category: HabitCategory | null;
};
// The signed-in adult's own and group habits: always categorised.
export type AdultHabitSummary = HabitSummary & { category: HabitCategory };
export type HistoryCell = Database["public"]["Functions"]["habit_history"]["Returns"][number];

export async function getHabitSummaries(): Promise<AdultHabitSummary[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("habit_summaries");
  if (error) throw new Error(`habit_summaries failed: ${error.message}`);
  // Read defensively: previews (and the minutes after a merge) can run this code before the
  // database has the emoji migration, so `emoji` may be missing and `category` still `money`.
  return (data ?? []).map((row) => {
    const category = normalizeCategory(row.category);
    return { ...row, category, emoji: habitEmoji(category, row.emoji), members: row.members ?? null };
  });
}

// The overview is extra: if it fails (e.g. the app deployed a moment before its migration), the
// page still loads without it rather than showing the error screen.
export async function getWeekOverview(): Promise<WeekOverview | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("week_overview");
  if (error || !data) {
    logError("week_overview failed", error?.message ?? "no data");
    return null;
  }
  return withTodayPending(data as unknown as WeekOverview);
}

// The recent check-ins a page is drawn with, read in the same request as its counts, for
// lib/rendered-taps.ts renderedTapIds: the viewer's own and these children's (`children`), from the
// last few days (a late check-in counts up to 3 days after the tap; a period can be a month, but a
// tap waits on the phone for minutes or days). Fails soft: without them the phone counts its taps
// as before.
export async function getRecentTapRows(children: readonly string[] = []): Promise<TapRow[]> {
  const { supabase, userId } = await requireUser();
  const since = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("check_ins")
    .select("client_id, habit_id, user_id, period_start")
    .in("user_id", [userId, ...children])
    .not("client_id", "is", null)
    .in("status", ["approved", "pending"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    logError("rendered taps failed", error.message);
    return [];
  }
  return data ?? [];
}

// Progress → tap a day: my own check-ins this week (RLS: own rows, plus my groups'; filtered to mine).
// Fails soft: without them the day list still shows daily habits from the overview.
export async function getMyCheckIns(from: string, to: string): Promise<DayCheckIn[]> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("check_ins")
    .select("habit_id, local_date, status")
    .eq("user_id", userId)
    .gte("local_date", from)
    .lte("local_date", to);
  if (error) {
    logError("my check-ins failed", error.message);
    return [];
  }
  return data ?? [];
}

// Ends (ideas/habit-end-date.md) aren't in habit_summaries; read them from habits (RLS: what you can
// see). Fails soft: without them the cards just don't show "Day 12 of 30".
export async function getHabitEnds(habitIds: string[]): Promise<Map<string, string>> {
  if (habitIds.length === 0) return new Map();
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("habits").select("id, ends_on").in("id", habitIds).not("ends_on", "is", null);
  if (error) {
    logError("habit ends failed", error.message);
    return new Map();
  }
  return new Map((data ?? []).map((r) => [r.id, r.ends_on as string]));
}

// Group time zones (RLS: members read their groups). A group habit, and a child's habit, run on the
// group's calendar (private.habit_timezone), so "today" and "ended" for them use this zone, not the
// viewer's. Fails soft: an empty map, and callers fall back to the viewer's zone.
export async function getGroupTimezones(groupIds: (string | null | undefined)[]): Promise<Map<string, string>> {
  const ids = [...new Set(groupIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map();
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("groups").select("id, timezone").in("id", ids);
  if (error) {
    logError("group time zones failed", error.message);
    return new Map();
  }
  return new Map((data ?? []).map((g) => [g.id, g.timezone]));
}

// Finished habits (ideas/habit-end-date.md) are archived with finished_at; the Finished tab lists them.
export async function getFinishedIds(): Promise<Set<string>> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("habits").select("id").not("finished_at", "is", null);
  if (error) {
    logError("finished habits failed", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.id));
}

export type FinishSummary = { done: number; total: number; best_streak: number };

export async function getFinishSummary(habitId: string): Promise<FinishSummary | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("habit_finish_summary", { p_habit_id: habitId });
  if (error || !data?.[0]) {
    if (error) logError("habit_finish_summary failed", error.message);
    return null;
  }
  return data[0];
}

// user_id null = the whole habit; otherwise the viewer's own member pause (group habits).
export type HabitFreeze = { id: string; starts_on: string; ends_on: string | null; user_id?: string | null };
export type HabitCheckIn = { id: string; local_date: string; created_at: string };
// Group habits: everyone's check-ins this period (for Cheer and Nudge on the habit page).
export type MemberCheckIn = { id: string; user_id: string; local_date: string; status: string };

export type HabitDetail = {
  summary: AdultHabitSummary;
  // Set when the habit is a child's own (the viewer is a guardian): the summary is then the child's.
  child: { id: string; name: string; groupId: string | null } | null;
  history: HistoryCell[];
  freezes: HabitFreeze[];
  checkIns: HabitCheckIn[];
  totalCheckIns: number;
  memberCheckIns: MemberCheckIn[];
  // Check-in ids the viewer has cheered, and who they nudged about this habit (this period).
  myCheers: string[];
  myNudges: { recipient_id: string; local_date: string }[];
};

export async function getHabitDetail(habitId: string): Promise<HabitDetail | null> {
  const { supabase, userId } = await requireUser();
  let summary: AdultHabitSummary | undefined = (await getHabitSummaries()).find((s) => s.habit_id === habitId);
  let child: HabitDetail["child"] = null;
  if (!summary) {
    // Not mine: a guardian's own list leaves out a child's habit, so read it from the child's.
    const { data: row } = await supabase.from("habits").select("owner_id, group_id").eq("id", habitId).maybeSingle();
    const kid = row?.owner_id && !row.group_id ? (await getMyChildren()).find((c) => c.child_id === row.owner_id) : undefined;
    if (!kid) return null;
    summary = (await getChildSummaries(kid.child_id)).find((s) => s.habit_id === habitId) as AdultHabitSummary | undefined;
    if (!summary) return null;
    child = { id: kid.child_id, name: kid.name, groupId: kid.group_id };
  }

  const isGroup = Boolean(summary.group_id);
  const [history, freezes, checkIns, total, memberCheckIns, myNudges] = await Promise.all([
    supabase.rpc("habit_history", { p_habit_id: habitId, p_limit: summary.period === "day" ? 84 : 12 }),
    // Group members can read everyone's pauses and check-ins; this page shows only the whole-habit
    // pauses and the viewer's own.
    supabase
      .from("habit_freezes")
      .select("id, starts_on, ends_on, user_id")
      .eq("habit_id", habitId)
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .order("starts_on"),
    supabase
      .from("check_ins")
      .select("id, local_date, created_at")
      .eq("habit_id", habitId)
      .eq("user_id", child?.id ?? userId)
      .eq("period_start", summary.period_start)
      .order("created_at", { ascending: false }),
    // Everyone's: a habit with any history can't be deleted (delete_habit's rule).
    supabase.from("check_ins").select("id", { count: "exact", head: true }).eq("habit_id", habitId),
    isGroup
      ? supabase
          .from("check_ins")
          .select("id, user_id, local_date, status")
          .eq("habit_id", habitId)
          .eq("period_start", summary.period_start)
          .order("created_at")
      : null,
    // RLS: the sender reads their own nudges.
    isGroup
      ? supabase
          .from("nudges")
          .select("recipient_id, local_date")
          .eq("habit_id", habitId)
          .eq("sender_id", userId)
          .gte("local_date", summary.period_start)
      : null,
  ]);
  for (const r of [history, freezes, checkIns, total]) {
    if (r.error) throw new Error(`habit detail failed: ${r.error.message}`);
  }
  // Cheer and Nudge are extras: their reads fail soft.
  for (const r of [memberCheckIns, myNudges]) {
    if (r?.error) logError("habit detail extras failed", r.error.message);
  }
  const others = (memberCheckIns?.data ?? []).filter((c) => c.user_id !== userId && c.status === "approved").map((c) => c.id);
  const cheers = others.length
    ? await supabase.from("cheers").select("check_in_id").eq("user_id", userId).in("check_in_id", others)
    : null;
  if (cheers?.error) logError("cheers read failed", cheers.error.message);

  return {
    summary,
    child,
    history: history.data ?? [],
    freezes: freezes.data ?? [],
    checkIns: checkIns.data ?? [],
    totalCheckIns: total.count ?? 0,
    memberCheckIns: memberCheckIns?.data ?? [],
    myCheers: (cheers?.data ?? []).map((c) => c.check_in_id),
    myNudges: myNudges?.data ?? [],
  };
}

// Progress → Calendar (ideas/progress-calendar.md): one row per day per habit in [from, to] (my own
// and the group habits I take part in).
// Fails soft: an empty month instead of an error page.
export async function getCalendarCells(from: string, to: string): Promise<CalendarCell[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("calendar_cells", { p_from: from, p_to: to });
  if (error) {
    logError("calendar_cells failed", error.message);
    return [];
  }
  return data ?? [];
}

// The first day any of my habits started (my own, and the group habits I take part in, from the day
// I joined): the calendar goes back no further. Fails soft: no earlier months.
export async function getFirstHabitStart(): Promise<string | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("calendar_start");
  if (error) {
    logError("calendar_start failed", error.message);
    return null;
  }
  return data ?? null;
}
