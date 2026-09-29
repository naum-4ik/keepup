import "server-only";
import { requireUser } from "@/lib/auth";
import { habitEmoji, normalizeCategory } from "@/lib/categories";
import type { Database } from "@/lib/database.types";
import { withTodayPending, type WeekOverview } from "@/lib/week-overview";

export type HabitSummary = Database["public"]["Functions"]["habit_summaries"]["Returns"][number];
export type HistoryCell = Database["public"]["Functions"]["habit_history"]["Returns"][number];

export async function getHabitSummaries(): Promise<HabitSummary[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("habit_summaries");
  if (error) throw new Error(`habit_summaries failed: ${error.message}`);
  // Read defensively: previews (and the minutes after a merge) can run this code before the
  // database has the emoji migration, so `emoji` may be missing and `category` still `money`.
  return (data ?? []).map((row) => {
    const category = normalizeCategory(row.category);
    return { ...row, category, emoji: habitEmoji(category, row.emoji) };
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

export type HabitFreeze = { id: string; starts_on: string; ends_on: string | null };
export type HabitCheckIn = { id: string; local_date: string; created_at: string };

export type HabitDetail = {
  summary: HabitSummary;
  history: HistoryCell[];
  freezes: HabitFreeze[];
  checkIns: HabitCheckIn[];
  totalCheckIns: number;
};

export async function getHabitDetail(habitId: string): Promise<HabitDetail | null> {
  const { supabase } = await requireUser();
  const summary = (await getHabitSummaries()).find((s) => s.habit_id === habitId);
  if (!summary) return null;

  const [history, freezes, checkIns, total] = await Promise.all([
    supabase.rpc("habit_history", { p_habit_id: habitId, p_limit: summary.period === "day" ? 84 : 12 }),
    supabase.from("habit_freezes").select("id, starts_on, ends_on").eq("habit_id", habitId).order("starts_on"),
    supabase
      .from("check_ins")
      .select("id, local_date, created_at")
      .eq("habit_id", habitId)
      .eq("period_start", summary.period_start)
      .order("created_at", { ascending: false }),
    supabase.from("check_ins").select("id", { count: "exact", head: true }).eq("habit_id", habitId),
  ]);
  for (const r of [history, freezes, checkIns, total]) {
    if (r.error) throw new Error(`habit detail failed: ${r.error.message}`);
  }

  return {
    summary,
    history: history.data ?? [],
    freezes: freezes.data ?? [],
    checkIns: checkIns.data ?? [],
    totalCheckIns: total.count ?? 0,
  };
}
