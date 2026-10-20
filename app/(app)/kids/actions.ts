"use server";

import type { Attributes } from "@opentelemetry/api";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAvatarColor, isAvatarEmoji } from "@/lib/avatars";
import { errorCode, habitErrorMessage } from "@/lib/habit-errors";
import { errorText } from "@/lib/field-error";
import { getT } from "@/lib/i18n/server";
import { isOneEmoji, isUuid, parseHabit } from "@/lib/habit-schema";
import { isKidTheme } from "@/lib/garden";
import { isKidTemplateId, KID_TEMPLATES, kidTemplateTitle } from "@/lib/kid-templates";
import { addedFlash, deletedFlash } from "@/lib/kid-toasts";
import { getMyChildren } from "@/lib/kids";
import { flashToast } from "@/lib/toast-server";
import { parseChildName, parseGender, parseGoal } from "@/lib/kid-schema";
import { logError, track } from "@/lib/log";

// code: the database rule that refused it ("keepup:<code>"), when there was one (an offline-queued
// tap is dropped only for a rule refusal; anything else keeps it queued).
export type KidActionResult = { ok: true } | { ok: false; message: string; code?: string };
// `field`: the message is about that field, so the form shows it beside it (none: the form's).
export type KidFormField = "name" | "title" | "emoji" | "targetCount" | "period" | "target";
export type KidFormState = { status: "idle" } | { status: "saved" } | { status: "error"; message: string; field?: KidFormField };

const notAvailable = async (): Promise<KidActionResult> => {
  const { t } = await getT();
  return { ok: false, message: t("errors.childUnavailable") };
};

// The child's pages, Today, and the group pages (a child's avatar and habits show on them).
function refresh(childId?: string) {
  revalidatePath("/today");
  revalidatePath("/groups/[id]", "page");
  if (childId) {
    revalidatePath(`/kids/${childId}`);
    revalidatePath(`/kids/${childId}/play`);
  }
}

const codeOf = (error: { message?: string }) => {
  const code = errorCode(error);
  return code ? { code } : {};
};

// event: the product event to send (lib/log.ts track): INFO when it worked, WARN with the rule that refused it.
async function call(
  childId: string | undefined,
  run: () => PromiseLike<{ error: { message: string } | null }>,
  event?: { name: string; who: Attributes; fields?: Attributes },
): Promise<KidActionResult> {
  const { t } = await getT();
  const { error } = await run();
  if (error) {
    const code = errorCode(error);
    if (event && code) track(event.name, event.who, { ...event.fields, "refusal.code": code }, "WARN");
    return { ok: false, message: habitErrorMessage(t, error), ...codeOf(error) };
  }
  if (event) track(event.name, event.who, event.fields);
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
  const { t } = await getT();
  const groupId = String(formData.get("groupId") ?? "");
  if (!isUuid(groupId)) return { status: "error", message: t("habits.actions.pickGroup") };
  const name = parseChildName(String(formData.get("name") ?? ""));
  if (!name.ok) return { status: "error", message: errorText(t, name.error), field: "name" };
  if (formData.get("guardian") !== "on") return { status: "error", message: habitErrorMessage(t, { message: "keepup:guardian_required" }) };
  const avatar = readAvatar(formData);
  const gender = parseGender(formData.get("gender") as string | null);
  const picked = new Set(formData.getAll("templates").map(String).filter(isKidTemplateId));

  const { supabase, who } = await requireUser();
  const { data: childId, error } = await supabase.rpc("create_child", {
    p_group_id: groupId,
    p_name: name.value,
    // No avatar picked: the initial on a pastel circle (the columns are nullable; the generated type isn't).
    p_avatar_emoji: avatar.emoji as unknown as string,
    p_avatar_color: avatar.color as unknown as string,
    p_guardian_confirmed: true,
  });
  if (error || !childId) return { status: "error", message: habitErrorMessage(t, error) };
  track("child_added", who, { "child.id": childId, "child.nickname": name.value, "group.id": groupId });

  // Optional. The child exists by now, so a failure here is logged and her page still opens.
  if (gender) {
    const { error: genderError } = await supabase.rpc("set_child_gender", { p_child_id: childId, p_gender: gender });
    if (genderError) logError("set_child_gender failed", genderError.message);
  }

  let habitsFailed = false;
  let habitsAdded = 0;
  // In template order, so her habit list reads like the picker.
  for (const tpl of KID_TEMPLATES.filter((x) => picked.has(x.id))) {
    const title = kidTemplateTitle(t, tpl.id);
    const { error: habitError } = await supabase.rpc("create_child_habit", {
      p_child_id: childId,
      p_title: title,
      p_emoji: tpl.emoji,
      p_target_count: tpl.targetCount,
      p_period: tpl.period,
      p_template_id: `kid.${tpl.id}`,
    });
    if (habitError) {
      logError("create_child_habit failed", habitError.message);
      habitsFailed = true;
    } else {
      habitsAdded++;
      track("child_habit_added", who, { "child.id": childId, "child.nickname": name.value, "habit.title": title, "habit.template_id": tpl.id, "habit.period": tpl.period, "habit.target_count": tpl.targetCount });
    }
  }
  refresh(childId);
  revalidatePath(`/groups/${groupId}`);
  // Her page shows her; the toast says what she starts with (a failed habit: the page's own note).
  await flashToast(addedFlash(name.value, habitsAdded));
  redirect(`/kids/${childId}${habitsFailed ? "?habitsFailed=1" : ""}`);
}

export async function updateChild(childId: string, _prev: KidFormState, formData: FormData): Promise<KidFormState> {
  const { t } = await getT();
  if (!isUuid(childId)) return { status: "error", message: t("errors.childUnavailable") };
  const name = parseChildName(String(formData.get("name") ?? ""));
  if (!name.ok) return { status: "error", message: errorText(t, name.error), field: "name" };
  const avatar = readAvatar(formData);
  const gender = parseGender(formData.get("gender") as string | null);
  const previousGender = parseGender(formData.get("previousGender") as string | null);
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("update_child", {
    p_child_id: childId,
    p_name: name.value,
    ...(avatar.emoji ? { p_avatar_emoji: avatar.emoji } : {}),
    ...(avatar.color ? { p_avatar_color: avatar.color } : {}),
  });
  if (error) return { status: "error", message: habitErrorMessage(t, error) };
  // "Not set" posts "" (null) and clears it; an unchanged choice skips the call.
  if (gender !== previousGender) {
    const { error: genderError } = await supabase.rpc("set_child_gender", { p_child_id: childId, p_gender: gender as unknown as string });
    if (genderError) return { status: "error", message: habitErrorMessage(t, genderError) };
  }
  refresh(childId);
  return { status: "saved" };
}

// A kid template (templateId) or "Create your own" (title, emoji, targetCount, period).
export async function addChildHabit(childId: string, _prev: KidFormState, formData: FormData): Promise<KidFormState> {
  const { t } = await getT();
  if (!isUuid(childId)) return { status: "error", message: t("errors.childUnavailable") };
  const templateId = String(formData.get("templateId") ?? "");
  let habit: { title: string; emoji: string; targetCount: number; period: "day" | "week" | "month" };
  if (templateId) {
    const tpl = KID_TEMPLATES.find((x) => x.id === templateId);
    if (!tpl) return { status: "error", message: t("kids.errors.pickHabit") };
    habit = { title: kidTemplateTitle(t, tpl.id), emoji: tpl.emoji, targetCount: tpl.targetCount, period: tpl.period };
  } else {
    const emoji = String(formData.get("emoji") ?? "").trim();
    if (emoji !== "" && !isOneEmoji(emoji)) return { status: "error", message: t("validation.emoji"), field: "emoji" };
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
      const field = (["title", "emoji", "targetCount", "period"] as const).find((f) => e[f]);
      return field ? { status: "error", message: errorText(t, e[field]!), field } : { status: "error", message: t("errors.checkDetails") };
    }
    habit = { title: parsed.value.title, emoji: emoji || "⭐", targetCount: parsed.value.targetCount, period: parsed.value.period };
  }
  const { supabase, who } = await requireUser();
  const { error } = await supabase.rpc("create_child_habit", {
    p_child_id: childId,
    p_title: habit.title,
    p_emoji: habit.emoji,
    p_target_count: habit.targetCount,
    p_period: habit.period,
    ...(templateId ? { p_template_id: `kid.${templateId}` } : {}),
  });
  if (error) return { status: "error", message: habitErrorMessage(t, error) };
  // habit.title is in the adult's language; habit.template_id names a template the same in every language.
  track("child_habit_added", who, { "child.id": childId, "habit.title": habit.title, "habit.template_id": templateId || undefined, "habit.period": habit.period, "habit.target_count": habit.targetCount });
  refresh(childId);
  return { status: "saved" };
}

export async function undoForChild(checkInId: string, habitId: string, childId: string): Promise<KidActionResult> {
  if (!isUuid(checkInId) || !isUuid(habitId) || !isUuid(childId)) return notAvailable();
  const { supabase, who } = await requireUser();
  const result = await call(childId, () => supabase.rpc("undo_check_in", { p_check_in_id: checkInId }), {
    name: "check_in_undone",
    who,
    fields: { "check_in.id": checkInId, "habit.id": habitId, "child.id": childId },
  });
  if (result.ok) revalidatePath(`/habits/${habitId}`);
  return result;
}

export async function setGoal(childId: string, _prev: KidFormState, formData: FormData): Promise<KidFormState> {
  const { t } = await getT();
  if (!isUuid(childId)) return { status: "error", message: t("errors.childUnavailable") };
  const goal = parseGoal({
    title: String(formData.get("title") ?? ""),
    emoji: String(formData.get("emoji") ?? ""),
    target: String(formData.get("target") ?? ""),
  });
  if (!goal.ok) return { status: "error", message: errorText(t, goal.error), field: goal.field };
  const { supabase, who } = await requireUser();
  const { error } = await supabase.rpc("set_treat_goal", {
    p_child_id: childId,
    p_title: goal.value.title,
    p_emoji: goal.value.emoji,
    p_target: goal.value.target,
  });
  if (error) return { status: "error", message: habitErrorMessage(t, error) };
  track("treat_goal_set", who, { "child.id": childId, "goal.target": goal.value.target });
  refresh(childId);
  return { status: "saved" };
}

export async function cancelGoal(goalId: string, childId: string): Promise<KidActionResult> {
  if (!isUuid(goalId) || !isUuid(childId)) return notAvailable();
  const { supabase } = await requireUser();
  return call(childId, () => supabase.rpc("cancel_treat_goal", { p_goal_id: goalId }));
}

export async function markReceived(goalId: string, childId: string): Promise<KidActionResult> {
  if (!isUuid(goalId) || !isUuid(childId)) return notAvailable();
  const { supabase, who } = await requireUser();
  return call(childId, () => supabase.rpc("mark_treat_received", { p_goal_id: goalId }), {
    name: "treat_received",
    who,
    fields: { "child.id": childId, "goal.id": goalId },
  });
}

// Admins of both groups (the RPC enforces it).
export async function moveChild(childId: string, toGroupId: string): Promise<KidActionResult> {
  if (!isUuid(childId) || !isUuid(toGroupId)) return notAvailable();
  const { supabase } = await requireUser();
  return call(childId, () => supabase.rpc("move_child", { p_child_id: childId, p_to_group_id: toGroupId }));
}

// Driven by a confirm dialog; on success the page is gone, so go to the group list with a toast. Her
// name is read before: afterwards she is gone from my_children(). Without it, no toast (fails soft).
export async function deleteChild(childId: string): Promise<KidActionResult> {
  if (!isUuid(childId)) return notAvailable();
  const { supabase } = await requireUser();
  // getMyChildren logs a failed read and answers [].
  const name = (await getMyChildren()).find((c) => c.child_id === childId)?.name ?? null;
  const result = await call(undefined, () => supabase.rpc("delete_child", { p_child_id: childId }));
  if (!result.ok) return result;
  revalidatePath("/groups");
  if (name) await flashToast(deletedFlash(name));
  redirect("/groups");
}

// Reset (admins; the RPC enforces it): everything except the nickname and avatar is cleared.
export async function resetChild(childId: string): Promise<KidActionResult> {
  if (!isUuid(childId)) return notAvailable();
  const { supabase, who } = await requireUser();
  return call(childId, () => supabase.rpc("reset_child", { p_child_id: childId }), { name: "child_reset", who, fields: { "child.id": childId } });
}

// The JSON for "Export {Mary}'s data"; the client saves it as a file.
export async function exportChild(childId: string): Promise<{ ok: true; data: unknown } | { ok: false; message: string }> {
  const { t } = await getT();
  if (!isUuid(childId)) return { ok: false, message: t("errors.childUnavailable") };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("export_child", { p_child_id: childId });
  if (error) return { ok: false, message: habitErrorMessage(t, error) };
  return { ok: true, data };
}

export async function setChildTheme(childId: string, theme: string): Promise<KidActionResult> {
  if (!isUuid(childId) || !isKidTheme(theme)) return notAvailable();
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("set_child_theme", { p_child_id: childId, p_theme: theme });
  if (error) {
    const { t } = await getT();
    return { ok: false, message: t("kids.errors.themeFailed") };
  }
  revalidatePath(`/kids/${childId}`);
  revalidatePath(`/kids/${childId}/play`);
  return { ok: true };
}
