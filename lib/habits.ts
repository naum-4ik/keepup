import "server-only";
import { requireUser } from "@/lib/auth";
import type { Database } from "@/lib/database.types";

export type HabitSummary = Database["public"]["Functions"]["habit_summaries"]["Returns"][number];
export type HistoryCell = Database["public"]["Functions"]["habit_history"]["Returns"][number];

export async function getHabitSummaries(): Promise<HabitSummary[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("habit_summaries");
  if (error) throw new Error(`habit_summaries failed: ${error.message}`);
  return data ?? [];
}
