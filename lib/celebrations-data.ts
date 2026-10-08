import "server-only";
import { requireUser } from "@/lib/auth";
import { celebrationQueue, isCelebrationMode, type Celebration, type CelebrationMode } from "@/lib/celebrations";
import { logError } from "@/lib/log";

export async function getCelebrationMode(): Promise<CelebrationMode> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase.from("profiles").select("celebrations").eq("id", userId).single();
  if (error) logError("celebrations mode failed", error.message);
  return isCelebrationMode(data?.celebrations) ? data.celebrations : "full";
}

// Fails soft: nothing to show rather than an error (deploy order).
export async function getPendingCelebrations(): Promise<{ mode: CelebrationMode; queue: Celebration[] }> {
  const { supabase } = await requireUser();
  const [mode, levels, badges] = await Promise.all([
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
      levels.data ?? [],
      (badges.data ?? []).map((b) => ({
        code: b.achievement_code, unlockedAt: b.unlocked_at, name: b.achievements?.name ?? "A new badge", icon: b.achievements?.icon ?? "Star",
      })),
    ),
  };
}
