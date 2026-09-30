"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { NUDGE_KINDS } from "@/lib/feed-copy";
import { errorCode, habitErrorMessage } from "@/lib/habit-errors";
import { isUuid } from "@/lib/habit-schema";

export type ReviewResult = { ok: true; reviewed: number } | { ok: false; message: string; code?: string };
export type SendResult = { ok: boolean; message?: string; code?: string };

function refresh() {
  revalidatePath("/inbox");
  revalidatePath("/today");
}

export async function review(checkInId: string, approve: boolean): Promise<ReviewResult> {
  if (!isUuid(checkInId)) return { ok: false, message: "That check-in isn't available." };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("review_check_in", { p_check_in_id: checkInId, p_approve: approve });
  refresh();
  if (error) return { ok: false, message: habitErrorMessage(error), code: errorCode(error) };
  return { ok: true, reviewed: 1 };
}

// Only ids from pending_approvals() (which leaves out the user's own): review_check_ins skips ones
// already reviewed or closed, but re-raises own_check_in.
export async function approveAll(checkInIds: string[]): Promise<ReviewResult> {
  const ids = checkInIds.filter(isUuid);
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("review_check_ins", { p_check_in_ids: ids, p_approve: true });
  refresh();
  if (error) return { ok: false, message: habitErrorMessage(error) };
  return { ok: true, reviewed: data ?? 0 };
}

export async function markAllRead(): Promise<void> {
  const { supabase } = await requireUser();
  await supabase.rpc("mark_feed_read", {});
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
