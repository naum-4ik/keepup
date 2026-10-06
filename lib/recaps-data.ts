import "server-only";
import { requireUser } from "@/lib/auth";
import { parseRecap, type Recap } from "@/lib/recaps";

// Fails soft: no history rather than an error screen (deploy order).
export async function getRecaps(kind: "week" | "month", count: number): Promise<Recap[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("recaps", { p_kind: kind, p_count: count });
  if (error) {
    console.error("recaps failed", error.message);
    return [];
  }
  return ((data ?? []) as unknown[]).map(parseRecap).filter((r): r is Recap => r !== null);
}
