"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { NUDGE_KINDS } from "@/lib/feed-copy";
import { errorCode, habitErrorMessage, reviewerOf } from "@/lib/habit-errors";
import { isUuid } from "@/lib/habit-schema";
import { getPendingApprovals } from "@/lib/inbox";
import { logError } from "@/lib/log";

export type ReviewResult = { ok: true; reviewed: number } | { ok: false; message: string; code?: string; reviewer?: string };
export type SendResult = { ok: boolean; message?: string; code?: string };

function refresh() {
  revalidatePath("/inbox");
  revalidatePath("/today");
}

export async function review(checkInId: string, approve: boolean): Promise<ReviewResult> {
  if (!isUuid(checkInId)) return { ok: false, message: "That check-in isn't available." };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("review_check_in", { p_check_in_id: checkInId, p_approve: approve });
  // Refresh only after a review that happened: a refresh on "already reviewed" re-rendered the Inbox
  // and took the row away with its note ("Dan already reviewed this."). The row leaves on the next visit.
  if (error) return { ok: false, message: habitErrorMessage(error), code: errorCode(error), reviewer: reviewerOf(error) };
  refresh();
  return { ok: true, reviewed: 1 };
}

const MAX_BATCH = 100;

// Approve only what pending_approvals() lists right now (it leaves out the user's own check-ins,
// which would make review_check_ins abort the whole batch). Ids the client sent that aren't there
// are dropped; ones that closed or were reviewed meanwhile are skipped by review_check_ins.
export async function approveAll(checkInIds: string[]): Promise<ReviewResult> {
  const pending = new Set((await getPendingApprovals()).map((a) => a.check_in_id));
  const ids = [...new Set(checkInIds)].filter((id) => isUuid(id) && pending.has(id)).slice(0, MAX_BATCH);
  if (ids.length === 0) {
    refresh();
    return { ok: true, reviewed: 0 };
  }
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("review_check_ins", { p_check_in_ids: ids, p_approve: true });
  refresh();
  if (error) return { ok: false, message: habitErrorMessage(error) };
  return { ok: true, reviewed: data ?? 0 };
}

// Marks read only the rows the viewer was shown (not older ones past the list, nor newer arrivals).
export async function markRead(ids: string[]): Promise<void> {
  const valid = [...new Set(ids)].filter(isUuid).slice(0, MAX_BATCH);
  if (valid.length === 0) return;
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("mark_feed_read", { p_ids: valid });
  if (error) logError("mark_feed_read failed", error.message);
  revalidatePath("/", "layout");
}

export async function nudge(habitId: string, recipientId: string, kind: string): Promise<SendResult> {
  if (!isUuid(habitId) || !isUuid(recipientId)) return { ok: false, message: "That habit isn't available." };
  if (!NUDGE_KINDS.some((k) => k.kind === kind)) return { ok: false, message: "Pick one of the messages." };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("nudge", { p_habit_id: habitId, p_recipient_id: recipientId, p_kind: kind });
  if (error) return { ok: false, message: habitErrorMessage(error), code: errorCode(error) };
  revalidatePath(`/habits/${habitId}`);
  return { ok: true };
}

export async function cheer(checkInId: string, habitId: string): Promise<SendResult> {
  if (!isUuid(checkInId) || !isUuid(habitId)) return { ok: false, message: "That check-in isn't available." };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("cheer", { p_check_in_id: checkInId });
  if (error) return { ok: false, message: habitErrorMessage(error) };
  revalidatePath(`/habits/${habitId}`);
  return { ok: true };
}
