import "server-only";
import { requireUser } from "@/lib/auth";
import { badgeName } from "@/lib/badges";
import { getT } from "@/lib/i18n/server";
import { celebrationQueue, isCelebrationMode, type Celebration, type CelebrationMode } from "@/lib/celebrations";
import { logError } from "@/lib/log";

export async function getCelebrationMode(): Promise<CelebrationMode> {
  const { supabase, userId } = await requireUser();
  // maybeSingle: a session can outlive its profile (a demo cleared after 24 hours, a deleted account), and
  // that is no error: the default mode will do (.single() logged "Cannot coerce the result to a single JSON object").
  const { data, error } = await supabase.from("profiles").select("celebrations").eq("id", userId).maybeSingle();
  if (error) logError("celebrations mode failed", error.message);
  return isCelebrationMode(data?.celebrations) ? data.celebrations : "full";
}

// Fails soft: nothing to show rather than an error (deploy order).
export async function getPendingCelebrations(): Promise<{ mode: CelebrationMode; queue: Celebration[] }> {
  const { supabase } = await requireUser();
  const [{ t }, mode, levels, badges] = await Promise.all([
    getT(),
    getCelebrationMode(),
    supabase.from("level_ups").select("level").is("seen_at", null),
    supabase.from("user_achievements").select("achievement_code, unlocked_at, achievements(name, icon)").is("seen_at", null),
  ]);
  if (levels.error || badges.error) {
    logError("celebrations failed", levels.error?.message ?? badges.error?.message);
    return { mode, queue: [] };
  }
  return {
    mode,
    queue: celebrationQueue(
      t,
      levels.data ?? [],
      (badges.data ?? []).map((b) => ({
        code: b.achievement_code, unlockedAt: b.unlocked_at, name: badgeName(t, b.achievement_code, b.achievements?.name ?? t("push.fallback.badge")), icon: b.achievements?.icon ?? "Star",
      })),
    ),
  };
}
