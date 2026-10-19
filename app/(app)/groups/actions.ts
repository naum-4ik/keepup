"use server";

import type { Attributes } from "@opentelemetry/api";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProfile, requireUser } from "@/lib/auth";
import { createdFlash, deletedFlash, leftFlash } from "@/lib/group-toasts";
import { flashToast } from "@/lib/toast-server";
import { isGroupAvatarEmoji, parseAvatar, type AvatarFormState } from "@/lib/avatars";
import { GROUP_NAME_MAX, isGroupKind, parseGroupName } from "@/lib/group-schema";
import { errorCode, habitErrorMessage } from "@/lib/habit-errors";
import { getT } from "@/lib/i18n/server";
import { isUuid } from "@/lib/habit-schema";
import { listTimezones } from "@/lib/timezones";
import { logError, track } from "@/lib/log";
import { errorText } from "@/lib/field-error";
import type { T } from "@/supabase/functions/_shared/i18n";

export type GroupActionState = { status: "idle" } | { status: "saved" } | { status: "error"; message: string; code?: string };

const fail = async (key: string): Promise<GroupActionState> => {
  const { t } = await getT();
  return { status: "error", message: t(key) };
};
const notFound = () => fail("errors.group_not_found");
const noMember = () => fail("errors.member_not_found");

// A name the database rejects arrives as a raw check violation, not a keepup: code.
const nameErrorMessage = (t: T, error: { code?: string; message?: string }) =>
  error.code === "23514" ? t("errors.groupNameLength", { max: GROUP_NAME_MAX }) : habitErrorMessage(t, error);

function refresh(groupId?: string) {
  revalidatePath("/groups");
  revalidatePath("/today");
  if (groupId) revalidatePath(`/groups/${groupId}`);
}

export async function createGroup(_prev: GroupActionState, formData: FormData): Promise<GroupActionState> {
  const { t } = await getT();
  const name = parseGroupName(String(formData.get("name") ?? ""));
  if (!name.ok) return { status: "error", message: errorText(t, name.error) };
  const kind = String(formData.get("kind") ?? "other");
  const avatar = parseAvatar(t, formData, isGroupAvatarEmoji);
  if (!avatar.ok) return { status: "error", message: avatar.message };
  const { supabase, who } = await requireUser();
  const { data, error } = await supabase.rpc("create_group", { p_name: name.value, p_kind: isGroupKind(kind) ? kind : "other" });
  if (error || !data) return { status: "error", message: error ? nameErrorMessage(t, error) : habitErrorMessage(t, null) };
  track("group_created", who, { "group.id": data.id, "group.kind": isGroupKind(kind) ? kind : "other" });
  // Optional: the group is created either way, so a failed avatar only logs (it can be set later).
  if (avatar.emoji || avatar.color !== "peach") {
    const { error: avatarError } = await supabase.rpc("set_group_avatar", { p_group_id: data.id, p_emoji: avatar.emoji ?? "", p_color: avatar.color });
    if (avatarError) logError("set_group_avatar failed", avatarError.message);
  }
  refresh();
  // A demo login can't invite (the group page says so), so its toast doesn't point at a link.
  const { profile } = await getProfile();
  await flashToast(createdFlash(name.value, !profile.is_demo));
  redirect(`/groups/${data.id}?invite=1`);
}

export async function renameGroup(groupId: string, _prev: GroupActionState, formData: FormData): Promise<GroupActionState> {
  const { t } = await getT();
  if (!isUuid(groupId)) return notFound();
  const name = parseGroupName(String(formData.get("name") ?? ""));
  if (!name.ok) return { status: "error", message: errorText(t, name.error) };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("update_group", { p_group_id: groupId, p_name: name.value });
  if (error) return { status: "error", message: nameErrorMessage(t, error) };
  refresh(groupId);
  return { status: "saved" };
}

export async function updateGroupSettings(groupId: string, _prev: GroupActionState, formData: FormData): Promise<GroupActionState> {
  const { t } = await getT();
  if (!isUuid(groupId)) return notFound();
  const timezone = String(formData.get("timezone") ?? "");
  const weekStart = String(formData.get("weekStart") ?? "");
  if (!listTimezones().includes(timezone)) return { status: "error", message: t("groups.errors.timezone") };
  if (weekStart !== "0" && weekStart !== "1") return { status: "error", message: t("groups.errors.weekStart") };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("update_group", { p_group_id: groupId, p_timezone: timezone, p_week_start: Number(weekStart) });
  if (error) return { status: "error", message: habitErrorMessage(t, error) };
  refresh(groupId);
  return { status: "saved" };
}

// event: the product event to send (lib/log.ts track): INFO when it worked, WARN with the rule that refused it.
async function run(
  groupId: string,
  call: () => PromiseLike<{ error: { message: string } | null }>,
  event?: { name: string; who: Attributes; fields?: Attributes },
): Promise<GroupActionState> {
  const { t } = await getT();
  const { error } = await call();
  if (error) {
    const code = errorCode(error);
    if (event && code) track(event.name, event.who, { "group.id": groupId, ...event.fields, "refusal.code": code }, "WARN");
    return { status: "error", message: habitErrorMessage(t, error), code };
  }
  if (event) track(event.name, event.who, { "group.id": groupId, ...event.fields });
  refresh(groupId);
  return { status: "saved" };
}

export async function createInvite(groupId: string): Promise<GroupActionState> {
  if (!isUuid(groupId)) return notFound();
  const { supabase, who } = await requireUser();
  return run(groupId, () => supabase.rpc("create_invite", { p_group_id: groupId }), { name: "invite_created", who });
}

export async function revokeInvites(groupId: string): Promise<GroupActionState> {
  if (!isUuid(groupId)) return notFound();
  const { supabase } = await requireUser();
  return run(groupId, () => supabase.rpc("revoke_invites", { p_group_id: groupId }));
}

export async function setMemberRole(groupId: string, userId: string, role: "admin" | "member"): Promise<GroupActionState> {
  if (!isUuid(groupId) || !isUuid(userId)) return noMember();
  // Server actions take any value from the client, whatever the type says.
  if (role !== "admin" && role !== "member") return fail("errors.invalid_role");
  const { supabase } = await requireUser();
  return run(groupId, () => supabase.rpc("set_member_role", { p_group_id: groupId, p_user_id: userId, p_role: role }));
}

export async function removeMember(groupId: string, userId: string): Promise<GroupActionState> {
  if (!isUuid(groupId) || !isUuid(userId)) return noMember();
  const { supabase, who } = await requireUser();
  return run(groupId, () => supabase.rpc("remove_member", { p_group_id: groupId, p_user_id: userId }), {
    name: "member_removed",
    who,
    fields: { "target.user.id": userId },
  });
}

// Leave/Delete return the code so the dialog can switch to the "children would be deleted" step
// (Task 10 adds Export and Move there).
export async function leaveGroup(groupId: string, confirmChildren: boolean): Promise<GroupActionState> {
  const { t } = await getT();
  if (!isUuid(groupId)) return notFound();
  const { supabase, who } = await requireUser();
  // Read before leaving: afterwards the group is out of reach (or gone, for its only member).
  const [{ name }, others] = await Promise.all([groupName(groupId), otherMembers(groupId)]);
  const { error } = await supabase.rpc("leave_group", { p_group_id: groupId, p_confirm_children: confirmChildren });
  if (error) return { status: "error", message: habitErrorMessage(t, error), code: errorCode(error) };
  track("member_left", who, { "group.id": groupId });
  refresh(groupId);
  if (name) await flashToast(leftFlash(name, others === 0));
  redirect("/groups");
}

export async function deleteGroup(groupId: string, confirmChildren: boolean): Promise<GroupActionState> {
  const { t } = await getT();
  if (!isUuid(groupId)) return notFound();
  const { supabase } = await requireUser();
  const { name } = await groupName(groupId);
  const { error } = await supabase.rpc("delete_group", { p_group_id: groupId, p_confirm_children: confirmChildren });
  if (error) return { status: "error", message: habitErrorMessage(t, error), code: errorCode(error) };
  refresh(groupId);
  if (name) await flashToast(deletedFlash(name));
  redirect("/groups");
}

// For the leave/delete toast. Fails soft: without a name, no toast (the redirect still happens).
async function groupName(groupId: string): Promise<{ name: string | null }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("groups").select("name").eq("id", groupId).maybeSingle();
  if (error) logError("group name for toast failed", error.message);
  return { name: data?.name ?? null };
}

// Current members other than me: 0 means leaving deletes the group. Unknown (an error) counts as
// others, so the toast never claims a deletion that didn't happen.
async function otherMembers(groupId: string): Promise<number> {
  const { supabase, userId } = await requireUser();
  const { count, error } = await supabase
    .from("group_members")
    .select("user_id", { count: "exact", head: true })
    .eq("group_id", groupId)
    .is("left_at", null)
    .neq("user_id", userId);
  if (error) logError("group member count for toast failed", error.message);
  return error || count == null ? 1 : count;
}

export async function saveGroupAvatar(groupId: string, _prev: AvatarFormState, formData: FormData): Promise<AvatarFormState> {
  const { t } = await getT();
  if (!isUuid(groupId)) return notFound();
  const avatar = parseAvatar(t, formData, isGroupAvatarEmoji);
  if (!avatar.ok) return { status: "error", message: avatar.message };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("set_group_avatar", { p_group_id: groupId, p_emoji: avatar.emoji ?? "", p_color: avatar.color });
  if (error) return { status: "error", message: habitErrorMessage(t, error) };
  refresh(groupId);
  return { status: "saved" };
}
