import "server-only";
import { requireUser } from "@/lib/auth";
import { habitNameFor } from "@/lib/habit-title";
import { getT } from "@/lib/i18n/server";
import { parseRecap, type Recap } from "@/lib/recaps";
import { namedPayload } from "@/supabase/functions/_shared/habit-title";
import { logError } from "@/lib/log";

// Fails soft: no history rather than an error screen (deploy order).
export async function getRecaps(kind: "week" | "month", count: number): Promise<Recap[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("recaps", { p_kind: kind, p_count: count });
  if (error) {
    logError("recaps failed", error.message);
    return [];
  }
  const name = habitNameFor((await getT()).t);
  // longest and top: template habits in the viewer's language.
  return ((data ?? []) as unknown[])
    .map((v) => parseRecap(typeof v === "object" && v !== null && !Array.isArray(v) ? namedPayload(v as Record<string, unknown>, name) : v))
    .filter((r): r is Recap => r !== null);
}
