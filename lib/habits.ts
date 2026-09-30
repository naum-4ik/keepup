import "server-only";
import { requireUser } from "@/lib/auth";
import { habitEmoji, normalizeCategory } from "@/lib/categories";
import type { Database } from "@/lib/database.types";
import type { HabitCategory } from "@/lib/habit-schema";
import { withTodayPending, type WeekOverview } from "@/lib/week-overview";

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
    console.error("week_overview failed", error?.message ?? "no data");
    return null;
  }
  return withTodayPending(data as unknown as WeekOverview);
}

// user_id null = the whole habit; otherwise the viewer's own member pause (group habits).
export type HabitFreeze = { id: string; starts_on: string; ends_on: string | null; user_id?: string | null };
export type HabitCheckIn = { id: string; local_date: string; created_at: string };
// Group habits: everyone's check-ins this period (for Cheer and Nudge on the habit page).
export type MemberCheckIn = { id: string; user_id: string; local_date: string; status: string };

export type HabitDetail = {
  summary: AdultHabitSummary;
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
  const summary = (await getHabitSummaries()).find((s) => s.habit_id === habitId);
  if (!summary) return null;

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
      .eq("user_id", userId)
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
    if (r?.error) console.error("habit detail extras failed", r.error.message);
  }
  const others = (memberCheckIns?.data ?? []).filter((c) => c.user_id !== userId && c.status === "approved").map((c) => c.id);
  const cheers = others.length
    ? await supabase.from("cheers").select("check_in_id").eq("user_id", userId).in("check_in_id", others)
    : null;
  if (cheers?.error) console.error("cheers read failed", cheers.error.message);

  return {
    summary,
    history: history.data ?? [],
    freezes: freezes.data ?? [],
    checkIns: checkIns.data ?? [],
    totalCheckIns: total.count ?? 0,
    memberCheckIns: memberCheckIns?.data ?? [],
    myCheers: (cheers?.data ?? []).map((c) => c.check_in_id),
    myNudges: myNudges?.data ?? [],
  };
}
