import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tagUser } from "@/lib/telemetry";
import type { Database } from "@/lib/database.types";

export type Profile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "display_name" | "timezone" | "reminder_hour" | "week_start" | "onboarded_at" | "purpose" | "avatar_emoji" | "avatar_color" | "is_demo"
>;

const BASE = "id, display_name, timezone, reminder_hour, week_start, onboarded_at, purpose, is_demo";

// Once per request: a page's loaders each call this, and getClaims (with its JWT check) needn't run
// a dozen times for one render.
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  tagUser(data.claims);
  return { supabase, userId };
});

export const getProfile = cache(async () => {
  const { supabase, userId } = await requireUser();
  // avatar_* arrive with the M3 migration; during a deploy the app can briefly run before it.
  let { data, error } = await supabase
    .from("profiles")
    .select(`${BASE}, avatar_emoji, avatar_color`)
    .eq("id", userId)
    .single<Profile>();
  if (error?.message.includes("avatar_")) {
    ({ data, error } = await supabase.from("profiles").select(BASE).eq("id", userId).single<Profile>());
  }
  if (error || !data) throw new Error(`Profile missing for ${userId}: ${error?.message ?? "no row"}`);
  return { supabase, userId, profile: data };
});
