import "server-only";
import { cache } from "react";
import { requireUser } from "@/lib/auth";
import { logError } from "@/lib/log";

// The person's XP and level (public.my_level). Fails soft: no level shown rather than an error screen
// (deploy order: the app can run a moment before its migration). Cached per request: the layout (the
// level on the Profile tab) and Profile both read it.
export const getMyLevel = cache(async (): Promise<{ xp: number; level: number } | null> => {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("my_level");
  if (error || !data?.[0]) {
    if (error) logError("my_level failed", error.message);
    return null;
  }
  return { xp: data[0].xp, level: data[0].level };
});
