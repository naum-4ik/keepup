"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProfile, requireUser } from "@/lib/auth";
import { insertHabits, setHabitEnd } from "@/lib/habit-create";
import { startAgainEnd } from "@/lib/habit-finish";
import { todayIn } from "@/lib/dates";
import { getGroupDetail } from "@/lib/groups";
import { GENERIC_ERROR, habitErrorMessage, REFRESH_ON_ERROR } from "@/lib/habit-errors";
import { reminderError } from "@/lib/reminder-mode";
import { isUuid, LOCAL_DATE, parseDetailsEdit, parseHabit, readHabitForm, type HabitFormState } from "@/lib/habit-schema";
import { logError, track } from "@/lib/log";

const NOT_FOUND: ActionResult = { ok: false, message: "That habit isn't available." };

// code: the database rule that refused it ("keepup:<code>"), when there was one. (A check-in tap
// goes through app/api/check-ins/tap instead, so the phone can stop waiting for it.)
export type ActionResult = { ok: true } | { ok: false; message: string; code?: string };
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
// with the habit already saved without it. Check first. Empty start = today in the habit's calendar:
// the user's zone, or the group's for a group habit (`timeZone`).
const END_BEFORE_START = "The last day can't be before the first day.";
async function endBeforeStart(formData: FormData, startsOn: string | undefined, timeZone?: string): Promise<boolean> {
  const endsOn = readEndsOn(formData);
  if (!endsOn) return false;
  return endsOn < (startsOn ?? todayIn(timeZone ?? (await getProfile()).profile.timezone));
}

export async function createHabit(_prev: HabitFormState, formData: FormData): Promise<HabitFormState> {
  const values = readHabitForm(formData);
  const parsed = parseHabit(values);
  if (!parsed.ok) return { status: "error", errors: parsed.errors, values };
  if (await endBeforeStart(formData, parsed.value.startsOn)) return { status: "error", message: END_BEFORE_START, values };

  const { supabase, who } = await requireUser();
  const { error, ids } = await insertHabits(supabase, [parsed.value]);
  if (error) {
    const message = habitErrorMessage(error);
    return { status: "error", message: message === GENERIC_ERROR ? "Couldn't save the habit. Try again." : message, values };
  }
  const endError = ids[0] ? await setHabitEnd(supabase, ids[0], readEndsOn(formData)) : null;
  if (endError) logError("set_habit_end failed", endError.message);

  const h = parsed.value;
  track("habit_created", who, { "habit.scope": "private", "habit.id": ids[0], "habit.title": h.title, "habit.category": h.category, "habit.period": h.period, "habit.target_count": h.targetCount });
  refresh();
  redirect("/today");
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
  const { supabase, who } = await requireUser();
  const { error } = await supabase.rpc("undo_check_in", { p_check_in_id: checkInId });
  if (error) return { ok: false, message: habitErrorMessage(error) };
  track("check_in_undone", who, { "check_in.id": checkInId, "habit.id": habitId });
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
  const parsed = parseDetailsEdit({
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
  const { supabase, who } = await requireUser();
  const { error } = await supabase
    .from("habits")
    .update({ ...parsed.value, ...(startsOn ? { starts_on: startsOn } : {}) })
    .eq("id", habitId);
  if (error) return { status: "error", message: habitErrorMessage(error) };
  track("habit_edited", who, { "habit.id": habitId, "habit.title": parsed.value.title, "habit.category": parsed.value.category ?? undefined });
  refresh(habitId);
  return { status: "saved" };
}

// archiveHabit/deleteHabit are driven by a confirm dialog via useActionState (not a plain
// <form>), so a failure must come back as state the dialog can show, not a thrown error.
// After archive or delete, a guardian lands back on the child's page; everyone else on their own list.
// Read before the change (a deleted habit can't be read) from the habit's own row (RLS: what I can see).
async function backTo(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, habitId: string, fallback: string) {
  const { data } = await supabase.from("habits").select("owner_id, group_id").eq("id", habitId).maybeSingle();
  return data && !data.group_id && data.owner_id && data.owner_id !== userId ? `/kids/${data.owner_id}` : fallback;
}

export async function archiveHabit(habitId: string): Promise<FormActionState> {
  if (!isUuid(habitId)) return { status: "error", message: "That habit isn't available." };
  const { supabase, userId, who } = await requireUser();
  const next = await backTo(supabase, userId, habitId, "/progress?view=archived");
  const { error } = await supabase.from("habits").update({ archived_at: new Date().toISOString() }).eq("id", habitId);
  if (error) return { status: "error", message: habitErrorMessage(error) };
  track("habit_archived", who, { "habit.id": habitId });
  refresh(habitId);
  if (next.startsWith("/kids/")) revalidatePath(next);
  redirect(next);
}

// Restore from Archived (not Finished): back on Today with its history; the archived days count as
// skipped, never missed (the RPC settles them).
export async function restoreHabit(habitId: string): Promise<ActionResult> {
  if (!isUuid(habitId)) return NOT_FOUND;
  const { supabase, userId, who } = await requireUser();
  const { error } = await supabase.rpc("restore_habit", { p_habit_id: habitId });
  if (error) return { ok: false, message: habitErrorMessage(error) };
  track("habit_restored", who, { "habit.id": habitId });
  refresh(habitId);
  // A guardian restoring a child's habit goes back to the child's page.
  const next = await backTo(supabase, userId, habitId, "/today");
  if (next.startsWith("/kids/")) revalidatePath(next);
  redirect(next);
}

export async function deleteHabit(habitId: string): Promise<FormActionState> {
  if (!isUuid(habitId)) return { status: "error", message: "That habit isn't available." };
  const { supabase, userId, who } = await requireUser();
  const next = await backTo(supabase, userId, habitId, "/today");
  const { error } = await supabase.rpc("delete_habit", { p_habit_id: habitId });
  if (error) return { status: "error", message: habitErrorMessage(error) };
  track("habit_deleted", who, { "habit.id": habitId });
  refresh();
  if (next.startsWith("/kids/")) revalidatePath(next);
  redirect(next);
}

// A group habit (admins only; the RPC enforces it). Children take part only when ticked.
export async function createGroupHabit(_prev: HabitFormState, formData: FormData): Promise<HabitFormState> {
  const values = readHabitForm(formData);
  const parsed = parseHabit(values);
  if (!parsed.ok) return { status: "error", errors: parsed.errors, values };
  const groupId = String(formData.get("groupId") ?? "");
  if (!isUuid(groupId)) return { status: "error", message: "Pick a group.", values };
  // No start = today in the group's calendar (read only when it matters).
  const group = readEndsOn(formData) && !parsed.value.startsOn ? await getGroupDetail(groupId) : null;
  if (await endBeforeStart(formData, parsed.value.startsOn, group?.timezone)) return { status: "error", message: END_BEFORE_START, values };
  const children = formData.getAll("children").map(String).filter(isUuid);
  const { supabase, who } = await requireUser();
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
  if (endError) logError("set_habit_end failed", endError.message);
  const h = parsed.value;
  track("habit_created", who, { "habit.scope": "group", "habit.id": created?.id, "group.id": groupId, "habit.title": h.title, "habit.category": h.category, "habit.period": h.period, "habit.target_count": h.targetCount });
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
  const { supabase, who } = await requireUser();
  const { error } = await supabase.rpc("finish_habit", { p_habit_id: habitId });
  if (error) return { ok: false, message: habitErrorMessage(error) };
  track("habit_finished", who, { "habit.id": habitId });
  refresh(habitId);
  return { ok: true };
}

// Start again from the Finished tab: a fresh copy with the same settings and length, from today (in
// the habit's calendar). The finished one keeps its history. A group habit keeps its children, the
// ones still in the group (create_group_habit refuses any other).
// The copy is made but its end couldn't be set: say so and point to the new habit, so a second tap
// doesn't make another copy.
export type StartAgainResult = ActionResult | { ok: false; message: string; startedId: string };

export async function startAgain(habitId: string): Promise<StartAgainResult> {
  if (!isUuid(habitId)) return { ok: false, message: "That habit isn't available." };
  const { supabase, who, profile } = await getProfile();
  const { data: h, error: readError } = await supabase.from("habits").select("*").eq("id", habitId).maybeSingle();
  if (readError || !h || !h.finished_at || !h.category) return { ok: false, message: "That habit isn't available." };
  let newId: string | undefined;
  let timeZone = profile.timezone;
  if (h.group_id) {
    const [group, participants] = await Promise.all([
      getGroupDetail(h.group_id),
      supabase.from("group_habit_participants").select("profile_id").eq("habit_id", habitId),
    ]);
    if (!group || participants.error) return { ok: false, message: GENERIC_ERROR };
    timeZone = group.timezone;
    const inGroup = new Set(group.children.map((c) => c.id));
    const children = (participants.data ?? []).map((p) => p.profile_id).filter((id) => inGroup.has(id));
    const { data, error } = await supabase.rpc("create_group_habit", {
      p_group_id: h.group_id,
      p_title: h.title,
      p_emoji: h.emoji,
      p_category: h.category,
      p_target_count: h.target_count,
      p_period: h.period,
      p_requires_approval: h.requires_approval,
      p_children: children,
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
  track("habit_restarted", who, { "habit.id": newId, "habit.restarted_from": habitId, "group.id": h.group_id ?? undefined, "habit.title": h.title, "habit.category": h.category, "habit.period": h.period, "habit.target_count": h.target_count });
  if (newId && h.ends_on) {
    const endError = await setHabitEnd(supabase, newId, startAgainEnd(h.starts_on, h.ends_on, todayIn(timeZone)));
    if (endError) {
      logError("set_habit_end failed", endError.message);
      refresh();
      return { ok: false, message: "Started again, but the end couldn't be set. Set it on the habit page.", startedId: newId };
    }
  }
  refresh();
  redirect("/today");
}

// "Remind me at…" (ideas/notifications-tone.md): the database stores it and the scheduler uses it.
export async function setHabitReminder(habitId: string, mode: string, remindAt: string | null): Promise<ActionResult> {
  if (!isUuid(habitId)) return NOT_FOUND;
  const invalid = reminderError(mode, remindAt);
  if (invalid) return { ok: false, message: invalid };
  const { supabase, who } = await requireUser();
  const { error } = await supabase.rpc("set_habit_reminder", {
    p_habit_id: habitId,
    p_mode: mode,
    ...(mode === "time" && remindAt ? { p_remind_at: remindAt } : {}),
  });
  if (error) return { ok: false, message: habitErrorMessage(error) };
  track("reminder_set", who, { "habit.id": habitId, "reminder.mode": mode, "reminder.time": mode === "time" ? (remindAt ?? undefined) : undefined });
  revalidatePath(`/habits/${habitId}`);
  return { ok: true };
}

export async function setHabitMute(habitId: string, muted: boolean): Promise<ActionResult> {
  if (!isUuid(habitId)) return NOT_FOUND;
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("set_habit_mute", { p_habit_id: habitId, p_muted: muted === true });
  if (error) return { ok: false, message: habitErrorMessage(error) };
  revalidatePath(`/habits/${habitId}`);
  return { ok: true };
}
