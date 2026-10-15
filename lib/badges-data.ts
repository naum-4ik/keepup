import "server-only";
import { requireUser } from "@/lib/auth";
import { badgeGrid, type BadgeGroup } from "@/lib/badges";
import { getT } from "@/lib/i18n/server";
import { logError } from "@/lib/log";

// Fails soft: no grid rather than an error screen (deploy order).
export async function getBadges(): Promise<BadgeGroup[]> {
  const { supabase } = await requireUser();
  const { t } = await getT();
  const [catalog, earned] = await Promise.all([
    supabase.from("achievements").select("code, name, description, icon, badge_group, sort_order"),
    supabase.from("user_achievements").select("achievement_code, unlocked_at"),
  ]);
  if (catalog.error || earned.error) {
    logError("badges failed", catalog.error?.message ?? earned.error?.message);
    return [];
  }
  return badgeGrid(t, catalog.data ?? [], earned.data ?? []);
}
