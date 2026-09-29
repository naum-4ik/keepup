import "server-only";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { HabitInput } from "@/lib/habit-schema";

// The one path that creates habits (new-habit screen and onboarding). Several habits go in as a
// single insert, so they're created all together or not at all. owner_id, week_start and the
// start-date rules are filled in and checked by the database.
export async function insertHabits(supabase: SupabaseClient<Database>, habits: HabitInput[]): Promise<PostgrestError | null> {
  const { error } = await supabase.from("habits").insert(
    habits.map((h) => ({
      title: h.title,
      category: h.category,
      target_count: h.targetCount,
      period: h.period,
      starts_on: h.startsOn,
    })),
  );
  return error;
}
