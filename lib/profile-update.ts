import type { SupabaseClient } from "@supabase/supabase-js";
import type { OnboardingInput, ProfileInput } from "@/lib/profile-schema";
import type { Database } from "@/lib/database.types";
import type { T } from "@/supabase/functions/_shared/i18n";

// Each form writes only the columns it owns: Settings never touches the purpose.
type ProfileUpdate = ProfileInput & Partial<Pick<OnboardingInput, "purpose">>;

// Returns null when saved, otherwise a message to show the user.
export async function saveProfile(
  t: T,
  supabase: SupabaseClient<Database>,
  userId: string,
  input: ProfileUpdate,
  opts: { markOnboarded: boolean },
): Promise<string | null> {
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: input.displayName,
      timezone: input.timezone,
      week_start: input.weekStart,
      ...(input.purpose !== undefined ? { purpose: input.purpose } : {}),
      // The database stores its own now() (and sets terms_accepted_at alongside) the first time only.
      ...(opts.markOnboarded ? { onboarded_at: new Date().toISOString() } : {}),
    })
    .eq("id", userId);

  if (!error) return null;
  // 23514 = check_violation. The name was validated already, so this is a zone Postgres doesn't know.
  if (error.code === "23514") return t("profile.errors.timezoneUnsupported");
  return t("profile.errors.saveFailed");
}
