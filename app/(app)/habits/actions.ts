"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { GENERIC_ERROR, habitErrorMessage } from "@/lib/habit-errors";
import { parseHabit, readHabitForm, type HabitFormState } from "@/lib/habit-schema";

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
