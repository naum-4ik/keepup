"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAvatarColor, isAvatarEmoji } from "@/lib/avatars";
import { habitErrorMessage } from "@/lib/habit-errors";
import { isOneEmoji, isUuid, parseHabit } from "@/lib/habit-schema";
import { isKidTheme } from "@/lib/garden";
import { isKidTemplateId, KID_TEMPLATES } from "@/lib/kid-templates";
import { parseChildName, parseGoal } from "@/lib/kid-schema";

export type KidActionResult = { ok: true } | { ok: false; message: string };
export type KidFormState = { status: "idle" } | { status: "saved" } | { status: "error"; message: string };

const NO_CHILD = "That child isn't available.";
const NOT_FOUND: KidActionResult = { ok: false, message: NO_CHILD };

// The child's pages, Today, and the group pages (a child's avatar and habits show on them).
function refresh(childId?: string) {
  revalidatePath("/today");
  revalidatePath("/groups/[id]", "page");
  if (childId) {
    revalidatePath(`/kids/${childId}`);
    revalidatePath(`/kids/${childId}/play`);
  }
}

async function call(childId: string | undefined, run: () => PromiseLike<{ error: { message: string } | null }>): Promise<KidActionResult> {
  const { error } = await run();
  if (error) return { ok: false, message: habitErrorMessage(error) };
  refresh(childId);
  return { ok: true };
}

function readAvatar(formData: FormData) {
  const emoji = String(formData.get("avatarEmoji") ?? "");
  const color = String(formData.get("avatarColor") ?? "");
  return { emoji: isAvatarEmoji(emoji) ? emoji : null, color: isAvatarColor(color) ? color : null };
}

// Add a child (admins; the RPC enforces it) with the picked kid templates, then open her page.
export async function addChild(_prev: KidFormState, formData: FormData): Promise<KidFormState> {
  const groupId = String(formData.get("groupId") ?? "");
  if (!isUuid(groupId)) return { status: "error", message: "Pick a group." };
  const name = parseChildName(String(formData.get("name") ?? ""));
  if (!name.ok) return { status: "error", message: name.error };
  if (formData.get("guardian") !== "on") return { status: "error", message: habitErrorMessage({ message: "keepup:guardian_required" }) };
  const avatar = readAvatar(formData);
  const picked = new Set(formData.getAll("templates").map(String).filter(isKidTemplateId));

  const { supabase } = await requireUser();
  const { data: childId, error } = await supabase.rpc("create_child", {
    p_group_id: groupId,
    p_name: name.value,
    // No avatar picked: the initial on a pastel circle (the columns are nullable; the generated type isn't).
    p_avatar_emoji: avatar.emoji as unknown as string,
    p_avatar_color: avatar.color as unknown as string,
    p_guardian_confirmed: true,
  });
  if (error || !childId) return { status: "error", message: habitErrorMessage(error) };

  let habitsFailed = false;
  // In template order, so her habit list reads like the picker.
  for (const t of KID_TEMPLATES.filter((t) => picked.has(t.id))) {
    const { error: habitError } = await supabase.rpc("create_child_habit", {
      p_child_id: childId,
      p_title: t.title,
      p_emoji: t.emoji,
      p_target_count: t.targetCount,
      p_period: t.period,
    });
    if (habitError) {
      console.error("create_child_habit failed", habitError.message);
      habitsFailed = true;
    }
  }
  refresh(childId);
  revalidatePath(`/groups/${groupId}`);
  redirect(`/kids/${childId}${habitsFailed ? "?habitsFailed=1" : ""}`);
}

export async function updateChild(childId: string, _prev: KidFormState, formData: FormData): Promise<KidFormState> {
  if (!isUuid(childId)) return { status: "error", message: NO_CHILD };
  const name = parseChildName(String(formData.get("name") ?? ""));
  if (!name.ok) return { status: "error", message: name.error };
  const avatar = readAvatar(formData);
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("update_child", {
    p_child_id: childId,
    p_name: name.value,
    ...(avatar.emoji ? { p_avatar_emoji: avatar.emoji } : {}),
    ...(avatar.color ? { p_avatar_color: avatar.color } : {}),
  });
  if (error) return { status: "error", message: habitErrorMessage(error) };
  refresh(childId);
  return { status: "saved" };
}

// A kid template (templateId) or "Create your own" (title, emoji, targetCount, period).
export async function addChildHabit(childId: string, _prev: KidFormState, formData: FormData): Promise<KidFormState> {
  if (!isUuid(childId)) return { status: "error", message: NO_CHILD };
  const templateId = String(formData.get("templateId") ?? "");
  let habit: { title: string; emoji: string; targetCount: number; period: "day" | "week" | "month" };
  if (templateId) {
    const t = KID_TEMPLATES.find((x) => x.id === templateId);
    if (!t) return { status: "error", message: "Pick a habit." };
    habit = { title: t.title, emoji: t.emoji, targetCount: t.targetCount, period: t.period };
  } else {
    const emoji = String(formData.get("emoji") ?? "").trim();
    if (emoji !== "" && !isOneEmoji(emoji)) return { status: "error", message: "Pick one emoji." };
    // The adult habit rules, minus the category (kid habits have none).
    const parsed = parseHabit({
      title: String(formData.get("title") ?? ""),
      emoji,
      category: "health",
      targetCount: String(formData.get("targetCount") ?? ""),
      period: String(formData.get("period") ?? ""),
      startsOn: "",
    });
    if (!parsed.ok) {
      const e = parsed.errors;
      return { status: "error", message: e.title ?? e.emoji ?? e.targetCount ?? e.period ?? "Check the details." };
    }
    habit = { title: parsed.value.title, emoji: emoji || "⭐", targetCount: parsed.value.targetCount, period: parsed.value.period };
  }
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("create_child_habit", {
    p_child_id: childId,
    p_title: habit.title,
    p_emoji: habit.emoji,
    p_target_count: habit.targetCount,
    p_period: habit.period,
  });
  if (error) return { status: "error", message: habitErrorMessage(error) };
  refresh(childId);
  return { status: "saved" };
}

// byChild: a tap in the kid view (logged_by stays null, "Mary did it").
export async function checkInFor(habitId: string, childId: string, byChild: boolean): Promise<KidActionResult> {
  if (!isUuid(habitId) || !isUuid(childId)) return NOT_FOUND;
  const { supabase } = await requireUser();
  const result = await call(childId, () =>
    supabase.rpc("check_in_for", { p_habit_id: habitId, p_child_id: childId, p_by_child: byChild === true }),
  );
  if (result.ok) revalidatePath(`/habits/${habitId}`);
  return result;
}

export async function undoForChild(checkInId: string, habitId: string, childId: string): Promise<KidActionResult> {
  if (!isUuid(checkInId) || !isUuid(habitId) || !isUuid(childId)) return NOT_FOUND;
  const { supabase } = await requireUser();
  const result = await call(childId, () => supabase.rpc("undo_check_in", { p_check_in_id: checkInId }));
  if (result.ok) revalidatePath(`/habits/${habitId}`);
  return result;
}

export async function setGoal(childId: string, _prev: KidFormState, formData: FormData): Promise<KidFormState> {
  if (!isUuid(childId)) return { status: "error", message: NO_CHILD };
  const goal = parseGoal({
    title: String(formData.get("title") ?? ""),
    emoji: String(formData.get("emoji") ?? ""),
    target: String(formData.get("target") ?? ""),
  });
  if (!goal.ok) return { status: "error", message: goal.error };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("set_treat_goal", {
    p_child_id: childId,
    p_title: goal.value.title,
    p_emoji: goal.value.emoji,
    p_target: goal.value.target,
  });
  if (error) return { status: "error", message: habitErrorMessage(error) };
  refresh(childId);
  return { status: "saved" };
}

export async function cancelGoal(goalId: string, childId: string): Promise<KidActionResult> {
  if (!isUuid(goalId) || !isUuid(childId)) return NOT_FOUND;
  const { supabase } = await requireUser();
  return call(childId, () => supabase.rpc("cancel_treat_goal", { p_goal_id: goalId }));
}

export async function markReceived(goalId: string, childId: string): Promise<KidActionResult> {
  if (!isUuid(goalId) || !isUuid(childId)) return NOT_FOUND;
  const { supabase } = await requireUser();
  return call(childId, () => supabase.rpc("mark_treat_received", { p_goal_id: goalId }));
}

// Admins of both groups (the RPC enforces it).
export async function moveChild(childId: string, toGroupId: string): Promise<KidActionResult> {
  if (!isUuid(childId) || !isUuid(toGroupId)) return NOT_FOUND;
  const { supabase } = await requireUser();
  return call(childId, () => supabase.rpc("move_child", { p_child_id: childId, p_to_group_id: toGroupId }));
}

// Driven by a confirm dialog; on success the page is gone, so go to the group list.
export async function deleteChild(childId: string): Promise<KidActionResult> {
  if (!isUuid(childId)) return NOT_FOUND;
  const { supabase } = await requireUser();
  const result = await call(undefined, () => supabase.rpc("delete_child", { p_child_id: childId }));
  if (!result.ok) return result;
  revalidatePath("/groups");
  redirect("/groups");
}

// Reset (admins; the RPC enforces it): everything except the nickname and avatar is cleared.
export async function resetChild(childId: string): Promise<KidActionResult> {
  if (!isUuid(childId)) return NOT_FOUND;
  const { supabase } = await requireUser();
  return call(childId, () => supabase.rpc("reset_child", { p_child_id: childId }));
}

// The JSON for "Export {Mary}'s data"; the client saves it as a file.
export async function exportChild(childId: string): Promise<{ ok: true; data: unknown } | { ok: false; message: string }> {
  if (!isUuid(childId)) return { ok: false, message: NO_CHILD };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("export_child", { p_child_id: childId });
  if (error) return { ok: false, message: habitErrorMessage(error) };
  return { ok: true, data };
}

export async function setChildTheme(childId: string, theme: string): Promise<KidActionResult> {
  if (!isUuid(childId) || !isKidTheme(theme)) return NOT_FOUND;
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("set_child_theme", { p_child_id: childId, p_theme: theme });
  if (error) return { ok: false, message: "Couldn't change it. Try again." };
  revalidatePath(`/kids/${childId}`);
  revalidatePath(`/kids/${childId}/play`);
  return { ok: true };
}
