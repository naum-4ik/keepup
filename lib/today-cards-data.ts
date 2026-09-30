import "server-only";
import { requireUser } from "@/lib/auth";
import type { FeedItem } from "@/lib/feed-copy";
import type { FamilyRecap } from "@/lib/today-cards";

// Everything the cards at the top of Today read. Each is extra around the page, so each fails soft
// (like getWeekOverview): on an error the card just doesn't show.

// Unseen "Everyone did it" and group milestone rows (seen_at null = not shown yet).
export async function getUnseenCelebrations(): Promise<FeedItem[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("inbox_feed", { p_limit: 200 });
  if (error) {
    console.error("inbox_feed failed", error.message);
    return [];
  }
  return (data ?? [])
    .filter((row) => !row.seen_at && (row.kind === "everyone_done" || row.kind === "group_milestone"))
    .map((row) => ({ ...row, payload: (row.payload ?? {}) as Record<string, unknown> }) as FeedItem);
}

export async function getFamilyRecaps(): Promise<FamilyRecap[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("family_recaps");
  if (error) {
    console.error("family_recaps failed", error.message);
    return [];
  }
  return (data ?? []) as FamilyRecap[];
}

// RLS: a user reads only their own dismissals.
export async function getDismissedCards(): Promise<Set<string>> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("dismissed_cards").select("card");
  if (error) {
    console.error("dismissed_cards failed", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.card));
}

// Gentle cards wait for the first check-in. On an error, assume not yet (no card).
export async function hasCheckedIn(): Promise<boolean> {
  const { supabase, userId } = await requireUser();
  const { count, error } = await supabase.from("check_ins").select("id", { head: true, count: "exact" }).eq("user_id", userId);
  if (error) {
    console.error("check-in count failed", error.message);
    return false;
  }
  return (count ?? 0) > 0;
}
