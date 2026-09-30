import "server-only";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { HabitInput } from "@/lib/habit-schema";

type HabitsInsert = Database["public"]["Tables"]["habits"]["Insert"];

// The one path that creates habits (new-habit screen and onboarding). Several habits go in as a
// single insert, so they're created all together or not at all. owner_id, week_start and the
// start-date rules are filled in and checked by the database.
export async function insertHabits(
  supabase: SupabaseClient<Database>,
  habits: HabitInput[],
): Promise<{ error: PostgrestError | null; ids: string[] }> {
  const { data, error } = await supabase.from("habits").insert(
    habits.map(
      (h) =>
        ({
          title: h.title,
          emoji: h.emoji,
          category: h.category,
          target_count: h.targetCount,
          period: h.period,
          ...(h.startsOn ? { starts_on: h.startsOn } : {}),
          // The generated type marks starts_on required (the column is NOT NULL), but the insert
          // trigger fills it with today in the owner's time zone when it's missing.
        }) as HabitsInsert,
    ),
  ).select("id");
  return { error, ids: (data ?? []).map((r) => r.id) };
}

// An end (ideas/habit-end-date.md) is set after creating, through the rule that checks it (never
// before today). The habit exists either way; a failure here is reported, not rolled back.
export async function setHabitEnd(supabase: SupabaseClient<Database>, habitId: string, endsOn: string): Promise<PostgrestError | null> {
  if (!endsOn) return null;
  const { error } = await supabase.rpc("set_habit_end", { p_habit_id: habitId, p_ends_on: endsOn });
  return error;
}
