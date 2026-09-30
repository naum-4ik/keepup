"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProfile, requireUser } from "@/lib/auth";
import { insertHabits, setHabitEnd } from "@/lib/habit-create";
import { startAgainEnd } from "@/lib/habit-finish";
import { todayIn } from "@/lib/dates";
import { GENERIC_ERROR, habitErrorMessage } from "@/lib/habit-errors";
import { isUuid, LOCAL_DATE, parseHabit, parseHabitDetails, readHabitForm, type HabitFormState } from "@/lib/habit-schema";

const NOT_FOUND: ActionResult = { ok: false, message: "That habit isn't available." };
// These errors mean another device (or midnight) already changed the habit; refresh so this card
// stops showing stale data.
const REFRESH_ON_ERROR = new Set(["target_reached", "already_checked_in_today", "habit_frozen", "habit_archived", "habit_not_found"]);

export type ActionResult = { ok: true } | { ok: false; message: string };
export type FormActionState = { status: "idle" } | { status: "saved" } | { status: "error"; message: string };

function refresh(habitId?: string) {
  revalidatePath("/today");
  revalidatePath("/progress");
  if (habitId) revalidatePath(`/habits/${habitId}`);
}

// "" (no end) or a valid date; anything else is treated as no end.
const readEndsOn = (formData: FormData) => {
  const v = String(formData.get("endsOn") ?? "");
  return LOCAL_DATE.test(v) ? v : "";
};

// The end is set after the habit is created, so an end before the start would be refused only then,
// with the habit already saved without it. Check first. Empty start = today (in the user's zone).
const END_BEFORE_START = "The last day can't be before the first day.";
async function endBeforeStart(formData: FormData, startsOn: string | undefined): Promise<boolean> {
  const endsOn = readEndsOn(formData);
  if (!endsOn) return false;
  const { profile } = await getProfile();
  return endsOn < (startsOn ?? todayIn(profile.timezone));
}

export async function createHabit(_prev: HabitFormState, formData: FormData): Promise<HabitFormState> {
  const values = readHabitForm(formData);
  const parsed = parseHabit(values);
  if (!parsed.ok) return { status: "error", errors: parsed.errors, values };
  if (await endBeforeStart(formData, parsed.value.startsOn)) return { status: "error", message: END_BEFORE_START, values };

  const { supabase } = await requireUser();
  const { error, ids } = await insertHabits(supabase, [parsed.value]);
  if (error) {
    const message = habitErrorMessage(error);
    return { status: "error", message: message === GENERIC_ERROR ? "Couldn't save the habit. Try again." : message, values };
  }
  const endError = ids[0] ? await setHabitEnd(supabase, ids[0], readEndsOn(formData)) : null;
  if (endError) console.error("set_habit_end failed", endError.message);

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

// "Me + Mary": my check-in and each child's in one call, all or nothing.
export async function checkInWith(habitId: string, childIds: string[]): Promise<ActionResult> {
  if (!isUuid(habitId) || !Array.isArray(childIds) || !childIds.every(isUuid)) return NOT_FOUND;
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("check_in_with", { p_habit_id: habitId, p_children: childIds });
  if (error) {
    const code = error.message?.match(/keepup:([a-z_]+)/)?.[1];
    if (code && REFRESH_ON_ERROR.has(code)) refresh(habitId);
    return { ok: false, message: habitErrorMessage(error) };
  }
  refresh(habitId);
  for (const id of childIds) revalidatePath(`/kids/${id}`);
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
  // An empty start means today, decided by the database in the owner's time zone.
  if ((startsOn !== "" && !LOCAL_DATE.test(startsOn)) || (endsOn !== "" && !LOCAL_DATE.test(endsOn))) {
    return { status: "error", message: "Pick valid dates." };
  }
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("freeze_habit", {
    p_habit_id: habitId,
    ...(startsOn ? { p_starts_on: startsOn } : {}),
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
    emoji: String(formData.get("emoji") ?? ""),
    category: String(formData.get("category") ?? ""),
  });
  if (!parsed.ok) {
    const { title, emoji, category } = parsed.errors;
    return { status: "error", message: title ?? emoji ?? category ?? "Check the details." };
  }
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

// Restore from Archived (not Finished): back on Today with its history; the archived days count as
// skipped, never missed (the RPC settles them).
export async function restoreHabit(habitId: string): Promise<ActionResult> {
  if (!isUuid(habitId)) return NOT_FOUND;
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("restore_habit", { p_habit_id: habitId });
  if (error) return { ok: false, message: habitErrorMessage(error) };
  refresh(habitId);
  redirect("/today");
}

export async function deleteHabit(habitId: string): Promise<FormActionState> {
  if (!isUuid(habitId)) return { status: "error", message: "That habit isn't available." };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("delete_habit", { p_habit_id: habitId });
  if (error) return { status: "error", message: habitErrorMessage(error) };
  refresh();
  redirect("/today");
}

// A group habit (admins only; the RPC enforces it). Children take part only when ticked.
export async function createGroupHabit(_prev: HabitFormState, formData: FormData): Promise<HabitFormState> {
  const values = readHabitForm(formData);
  const parsed = parseHabit(values);
  if (!parsed.ok) return { status: "error", errors: parsed.errors, values };
  const groupId = String(formData.get("groupId") ?? "");
  if (!isUuid(groupId)) return { status: "error", message: "Pick a group.", values };
  if (await endBeforeStart(formData, parsed.value.startsOn)) return { status: "error", message: END_BEFORE_START, values };
  const children = formData.getAll("children").map(String).filter(isUuid);
  const { supabase } = await requireUser();
  const { data: created, error } = await supabase.rpc("create_group_habit", {
    p_group_id: groupId,
    p_title: parsed.value.title,
    p_emoji: parsed.value.emoji,
    p_category: parsed.value.category,
    p_target_count: parsed.value.targetCount,
    p_period: parsed.value.period,
    ...(parsed.value.startsOn ? { p_starts_on: parsed.value.startsOn } : {}),
    p_requires_approval: formData.get("requiresApproval") === "on",
    p_children: children,
  });
  if (error) return { status: "error", message: habitErrorMessage(error), values };
  const endError = created ? await setHabitEnd(supabase, created.id, readEndsOn(formData)) : null;
  if (endError) console.error("set_habit_end failed", endError.message);
  refresh();
  revalidatePath(`/groups/${groupId}`);
  redirect("/today");
}

// A member pause: the same dates rules as freezeHabit; p_profile_id omitted means "me".
export async function pauseMe(habitId: string, _prev: FormActionState, formData: FormData): Promise<FormActionState> {
  if (!isUuid(habitId)) return { status: "error", message: "That habit isn't available." };
  const startsOn = String(formData.get("startsOn") ?? "");
  const endsOn = String(formData.get("endsOn") ?? "");
  if ((startsOn !== "" && !LOCAL_DATE.test(startsOn)) || (endsOn !== "" && !LOCAL_DATE.test(endsOn))) {
    return { status: "error", message: "Pick valid dates." };
  }
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("freeze_member", {
    p_habit_id: habitId,
    ...(startsOn ? { p_starts_on: startsOn } : {}),
    ...(endsOn ? { p_ends_on: endsOn } : {}),
  });
  if (error) return { status: "error", message: habitErrorMessage(error) };
  refresh(habitId);
  return { status: "saved" };
}

export async function resumeMe(habitId: string): Promise<ActionResult> {
  if (!isUuid(habitId)) return NOT_FOUND;
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("unfreeze_member", { p_habit_id: habitId });
  if (error) return { ok: false, message: habitErrorMessage(error) };
  refresh(habitId);
  return { ok: true };
}

// Set, extend or remove the end from the habit page (the rule refuses earlier than today or the
// current end; group habits need an admin).
export async function changeHabitEnd(habitId: string, endsOn: string | null): Promise<ActionResult> {
  if (!isUuid(habitId) || (endsOn !== null && !LOCAL_DATE.test(endsOn))) return { ok: false, message: "Pick a date." };
  const { supabase } = await requireUser();
  // null removes the end; the generated type can't express a nullable argument.
  const { error } = await supabase.rpc("set_habit_end", { p_habit_id: habitId, p_ends_on: endsOn as string });
  if (error) return { ok: false, message: habitErrorMessage(error) };
  refresh(habitId);
  return { ok: true };
}

// The finish card's two choices (ideas/habit-end-date.md). Owners, or admins for group habits.
export async function keepGoing(habitId: string): Promise<ActionResult> {
  if (!isUuid(habitId)) return { ok: false, message: "That habit isn't available." };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("keep_going", { p_habit_id: habitId });
  if (error) return { ok: false, message: habitErrorMessage(error) };
  refresh(habitId);
  return { ok: true };
}

export async function finishHabit(habitId: string): Promise<ActionResult> {
  if (!isUuid(habitId)) return { ok: false, message: "That habit isn't available." };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("finish_habit", { p_habit_id: habitId });
  if (error) return { ok: false, message: habitErrorMessage(error) };
  refresh(habitId);
  return { ok: true };
}

// Start again from the Finished tab: a fresh copy with the same settings and length, from today.
// The finished one keeps its history.
export async function startAgain(habitId: string): Promise<ActionResult> {
  if (!isUuid(habitId)) return { ok: false, message: "That habit isn't available." };
  const { supabase, profile } = await getProfile();
  const { data: h, error: readError } = await supabase.from("habits").select("*").eq("id", habitId).maybeSingle();
  if (readError || !h || !h.finished_at || !h.category) return { ok: false, message: "That habit isn't available." };
  let newId: string | undefined;
  if (h.group_id) {
    const { data, error } = await supabase.rpc("create_group_habit", {
      p_group_id: h.group_id,
      p_title: h.title,
      p_emoji: h.emoji,
      p_category: h.category,
      p_target_count: h.target_count,
      p_period: h.period,
      p_requires_approval: h.requires_approval,
      p_children: [],
    });
    if (error) return { ok: false, message: habitErrorMessage(error) };
    newId = data?.id;
  } else {
    const { error, ids } = await insertHabits(supabase, [
      { title: h.title, emoji: h.emoji, category: h.category, targetCount: h.target_count, period: h.period, startsOn: "" },
    ]);
    if (error) return { ok: false, message: habitErrorMessage(error) };
    newId = ids[0];
  }
  if (newId && h.ends_on) {
    const endError = await setHabitEnd(supabase, newId, startAgainEnd(h.starts_on, h.ends_on, todayIn(profile.timezone)));
    if (endError) console.error("set_habit_end failed", endError.message);
  }
  refresh();
  redirect("/today");
}
