"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { insertHabits } from "@/lib/habit-create";
import { GENERIC_ERROR, habitErrorMessage } from "@/lib/habit-errors";
import { isUuid, LOCAL_DATE, parseHabit, parseHabitDetails, readHabitForm, type HabitFormState } from "@/lib/habit-schema";

const NOT_FOUND: ActionResult = { ok: false, message: "That habit isn't available." };
// These errors mean another device already changed the count; refresh so this card stops showing stale data.
const REFRESH_ON_ERROR = new Set(["target_reached", "already_checked_in_today"]);

export type ActionResult = { ok: true } | { ok: false; message: string };
export type FormActionState = { status: "idle" } | { status: "saved" } | { status: "error"; message: string };

function refresh(habitId?: string) {
  revalidatePath("/today");
  revalidatePath("/progress");
  if (habitId) revalidatePath(`/habits/${habitId}`);
}

export async function createHabit(_prev: HabitFormState, formData: FormData): Promise<HabitFormState> {
  const values = readHabitForm(formData);
  const parsed = parseHabit(values);
  if (!parsed.ok) return { status: "error", errors: parsed.errors, values };

  const { supabase } = await requireUser();
  const error = await insertHabits(supabase, [parsed.value]);
  if (error) {
    const message = habitErrorMessage(error);
    return { status: "error", message: message === GENERIC_ERROR ? "Couldn't save the habit. Try again." : message, values };
  }

  refresh();
  redirect("/today");
}

export async function checkIn(habitId: string): Promise<ActionResult> {
  if (!isUuid(habitId)) return NOT_FOUND;
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("check_in", { p_habit_id: habitId });
  if (error) {
    const code = error.message?.match(/keepup:([a-z_]+)/)?.[1];
    if (code && REFRESH_ON_ERROR.has(code)) refresh(habitId);
    return { ok: false, message: habitErrorMessage(error) };
  }
  refresh(habitId);
  return { ok: true };
}

export async function undoCheckIn(checkInId: string, habitId: string): Promise<ActionResult> {
  if (!isUuid(checkInId) || !isUuid(habitId)) return NOT_FOUND;
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("undo_check_in", { p_check_in_id: checkInId });
  if (error) return { ok: false, message: habitErrorMessage(error) };
  refresh(habitId);
  return { ok: true };
}

export async function freezeHabit(habitId: string, _prev: FormActionState, formData: FormData): Promise<FormActionState> {
  if (!isUuid(habitId)) return { status: "error", message: "That habit isn't available." };
  const startsOn = String(formData.get("startsOn") ?? "");
  const endsOn = String(formData.get("endsOn") ?? "");
  if (!LOCAL_DATE.test(startsOn) || (endsOn !== "" && !LOCAL_DATE.test(endsOn))) {
    return { status: "error", message: "Pick valid dates." };
  }
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("freeze_habit", {
    p_habit_id: habitId,
    p_starts_on: startsOn,
    ...(endsOn ? { p_ends_on: endsOn } : {}),
  });
  if (error) return { status: "error", message: habitErrorMessage(error) };
  refresh(habitId);
  return { status: "saved" };
}

export async function unfreezeHabit(habitId: string): Promise<ActionResult> {
  if (!isUuid(habitId)) return NOT_FOUND;
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("unfreeze_habit", { p_habit_id: habitId });
  if (error) return { ok: false, message: habitErrorMessage(error) };
  refresh(habitId);
  return { ok: true };
}

export async function updateHabitDetails(habitId: string, _prev: FormActionState, formData: FormData): Promise<FormActionState> {
  if (!isUuid(habitId)) return { status: "error", message: "That habit isn't available." };
  const parsed = parseHabitDetails({
    title: String(formData.get("title") ?? ""),
    category: String(formData.get("category") ?? ""),
  });
  if (!parsed.ok) return { status: "error", message: parsed.errors.title ?? parsed.errors.category ?? "Check the details." };
  const startsOn = String(formData.get("startsOn") ?? "");
  if (startsOn !== "" && !LOCAL_DATE.test(startsOn)) return { status: "error", message: "Pick a start date." };
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("habits")
    .update({ ...parsed.value, ...(startsOn ? { starts_on: startsOn } : {}) })
    .eq("id", habitId);
  if (error) return { status: "error", message: habitErrorMessage(error) };
  refresh(habitId);
  return { status: "saved" };
}

// archiveHabit/deleteHabit are driven by a confirm dialog via useActionState (not a plain
// <form>), so a failure must come back as state the dialog can show, not a thrown error.
export async function archiveHabit(habitId: string): Promise<FormActionState> {
  if (!isUuid(habitId)) return { status: "error", message: "That habit isn't available." };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("habits").update({ archived_at: new Date().toISOString() }).eq("id", habitId);
  if (error) return { status: "error", message: habitErrorMessage(error) };
  refresh(habitId);
  redirect("/progress?view=archived");
}

export async function deleteHabit(habitId: string): Promise<FormActionState> {
  if (!isUuid(habitId)) return { status: "error", message: "That habit isn't available." };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("delete_habit", { p_habit_id: habitId });
  if (error) return { status: "error", message: habitErrorMessage(error) };
  refresh();
  redirect("/today");
}
