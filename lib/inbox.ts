import "server-only";
import { requireUser } from "@/lib/auth";
import type { Database } from "@/lib/database.types";
import { FEED_KINDS, isFeedKind, type FeedItem } from "@/lib/feed-copy";

export type PendingApproval = Database["public"]["Functions"]["pending_approvals"]["Returns"][number];

// All three are extras around the page: on an error (e.g. the app deployed a moment before its
// migration) they return empty, like getWeekOverview, rather than showing the error screen.
export async function getFeed(): Promise<FeedItem[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("inbox_feed", { p_limit: 60 });
  if (error) {
    console.error("inbox_feed failed", error.message);
    return [];
  }
  return (data ?? [])
    .filter((row) => isFeedKind(row.kind))
    .map((row) => ({ ...row, payload: (row.payload ?? {}) as Record<string, unknown> }) as FeedItem);
}

export async function getPendingApprovals(): Promise<PendingApproval[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("pending_approvals");
  if (error) {
    console.error("pending_approvals failed", error.message);
    return [];
  }
  return data ?? [];
}

// RLS: a user reads only their own notifications.
export async function getUnreadCount(): Promise<number> {
  const { supabase } = await requireUser();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null)
    .in("kind", [...FEED_KINDS]);
  if (error) {
    console.error("unread count failed", error.message);
    return 0;
  }
  return count ?? 0;
}
