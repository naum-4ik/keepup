import "server-only";
import { requireUser } from "@/lib/auth";
import type { Database } from "@/lib/database.types";
import { FEED_KINDS, isFeedKind, type FeedItem } from "@/lib/feed-copy";
import { habitNameFor } from "@/lib/habit-title";
import { getT } from "@/lib/i18n/server";
import { namedPayload, type HabitName } from "@/supabase/functions/_shared/habit-title";
import { logError } from "@/lib/log";

export type PendingApproval = Database["public"]["Functions"]["pending_approvals"]["Returns"][number];
type FeedRow = Database["public"]["Functions"]["inbox_feed"]["Returns"][number];

// A feed row as the viewer reads it: the habit's title, and the payload's habit rows (daily summary,
// recaps), by template in the viewer's language. Shared with Today's cards (lib/today-cards-data.ts).
export function namedFeedItem(row: FeedRow, name: HabitName): FeedItem {
  const habitTitle = row.habit_title == null ? row.habit_title : name(row.habit_title, row.habit_template);
  return { ...row, habit_title: habitTitle, payload: namedPayload((row.payload ?? {}) as Record<string, unknown>, name) } as FeedItem;
}

// All three are extras around the page: on an error (e.g. the app deployed a moment before its
// migration) they return empty, like getWeekOverview, rather than showing the error screen.
export async function getFeed(): Promise<FeedItem[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("inbox_feed", { p_limit: 60 });
  if (error) {
    logError("inbox_feed failed", error.message);
    return [];
  }
  const name = habitNameFor((await getT()).t);
  return (data ?? []).filter((row) => isFeedKind(row.kind)).map((row) => namedFeedItem(row, name));
}

export async function getPendingApprovals(): Promise<PendingApproval[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("pending_approvals");
  if (error) {
    logError("pending_approvals failed", error.message);
    return [];
  }
  const name = habitNameFor((await getT()).t);
  return (data ?? []).map((a) => ({ ...a, habit_title: name(a.habit_title, a.habit_template) }));
}

// RLS: a user reads only their own notifications.
export async function getUnreadCount(): Promise<number> {
  const { supabase } = await requireUser();
  const { count, error, status } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null)
    .in("kind", [...FEED_KINDS]);
  if (error) {
    // A count-only (HEAD) request has no body, so a failure has no message: the status says what happened.
    logError("unread count failed", error.message || `HTTP ${status}`);
    return 0;
  }
  return count ?? 0;
}
