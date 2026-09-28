import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  display_name: string;
  timezone: string;
  reminder_hour: number;
  onboarded_at: string | null;
};

export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  return { supabase, userId };
}

export const getProfile = cache(async () => {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, timezone, reminder_hour, onboarded_at")
    .eq("id", userId)
    .single<Profile>();
  if (error || !data) throw new Error(`Profile missing for ${userId}: ${error?.message ?? "no row"}`);
  return { supabase, userId, profile: data };
});
