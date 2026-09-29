"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { GENERIC_ERROR, habitErrorMessage } from "@/lib/habit-errors";
import { isUuid, parseHabit, readHabitForm, type HabitFormState } from "@/lib/habit-schema";

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
  const { error } = await supabase.from("habits").insert({
    title: parsed.value.title,
    category: parsed.value.category,
    target_count: parsed.value.targetCount,
    period: parsed.value.period,
    starts_on: parsed.value.startsOn,
  });
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
