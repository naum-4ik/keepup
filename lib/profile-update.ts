import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileInput } from "@/lib/profile-schema";
import type { Database } from "@/lib/database.types";

// Returns null when saved, otherwise a message to show the user.
export async function saveProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: ProfileInput,
  opts: { markOnboarded: boolean },
): Promise<string | null> {
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: input.displayName,
      timezone: input.timezone,
      reminder_hour: input.reminderHour,
      ...(opts.markOnboarded ? { onboarded_at: new Date().toISOString() } : {}),
    })
    .eq("id", userId);

  if (!error) return null;
  // 23514 = check_violation. The name was validated already, so this is a zone Postgres doesn't know.
  if (error.code === "23514") return "That time zone isn't supported. Pick a nearby city.";
  return "Couldn't save. Try again.";
}
