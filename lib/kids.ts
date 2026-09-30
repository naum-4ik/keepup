import "server-only";
import { requireUser } from "@/lib/auth";
import type { AvatarColor } from "@/lib/avatars";
import { habitEmoji, normalizeCategory } from "@/lib/categories";
import type { Database } from "@/lib/database.types";
import type { HabitSummary } from "@/lib/habits";

export type MyChild = Omit<Database["public"]["Functions"]["my_children"]["Returns"][number], "avatar_color"> & {
  avatar_color: AvatarColor | null;
};

export type TreatGoal = {
  id: string;
  title: string;
  emoji: string;
  target: number;
  // Stays set after an undo: a reached goal reads as reached.
  reached_at: string | null;
  stars: number;
};
export type ChildRewards = {
  week_start: string;
  stars_this_week: number;
  stage: number;
  total_stars: number;
  album: { week_start: string; stars: number; stage: number }[];
  goal: TreatGoal | null;
};

// This period's check-ins of a child (undo, and who logged each one). logged_by null = the kid view.
export type ChildCheckIn = { id: string; habit_id: string; local_date: string; created_at: string; logged_by: string | null };

// All fail soft (deploy lesson): errors are logged and read as empty, so Today still loads.
export async function getMyChildren(): Promise<MyChild[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("my_children");
  if (error) {
    console.error("my_children failed", error.message);
    return [];
  }
  return (data ?? []) as MyChild[];
}

export async function getChildSummaries(childId: string): Promise<HabitSummary[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("child_summaries", { p_child_id: childId });
  if (error) {
    console.error("child_summaries failed", error.message);
    return [];
  }
  // Same mapping as getHabitSummaries, except a kid habit's null category stays null (⭐ fallback).
  return (data ?? []).map((row) => {
    const raw = row.category as string | null;
    const category = raw == null ? null : normalizeCategory(raw);
    return {
      ...row,
      category,
      emoji: category ? habitEmoji(category, row.emoji) : row.emoji?.trim() || "⭐",
      members: row.members ?? null,
    };
  });
}

export async function getChildRewards(childId: string): Promise<ChildRewards | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("child_rewards", { p_child_id: childId });
  if (error || !data) {
    console.error("child_rewards failed", error?.message ?? "no data");
    return null;
  }
  return data as unknown as ChildRewards;
}

export async function getChildCheckIns(childId: string, habits: Pick<HabitSummary, "habit_id" | "period_start">[]): Promise<ChildCheckIn[]> {
  if (habits.length === 0) return [];
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("check_ins")
    .select("id, habit_id, local_date, created_at, logged_by, period_start")
    .eq("user_id", childId)
    .in("habit_id", habits.map((h) => h.habit_id))
    .neq("status", "rejected")
    .gte("period_start", habits.map((h) => h.period_start).sort()[0])
    .order("created_at", { ascending: false });
  if (error) {
    console.error("child check-ins failed", error.message);
    return [];
  }
  const current = new Map(habits.map((h) => [h.habit_id, h.period_start]));
  return (data ?? [])
    .filter((c) => current.get(c.habit_id) === c.period_start)
    .map((c) => ({ id: c.id, habit_id: c.habit_id, local_date: c.local_date, created_at: c.created_at, logged_by: c.logged_by }));
}
