"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isGroupKind, parseGroupName } from "@/lib/group-schema";
import { habitErrorMessage } from "@/lib/habit-errors";
import { isUuid } from "@/lib/habit-schema";
import { listTimezones } from "@/lib/timezones";

export type GroupActionState = { status: "idle" } | { status: "saved" } | { status: "error"; message: string; code?: string };

const NOT_FOUND: GroupActionState = { status: "error", message: "That group isn't available." };
const NO_MEMBER: GroupActionState = { status: "error", message: "That person isn't in this group." };
const NAME_ERROR = "Give the group a name up to 40 characters.";
const code = (m?: string) => m?.match(/keepup:([a-z_]+)/)?.[1];

// A name the database rejects arrives as a raw check violation, not a keepup: code.
const nameErrorMessage = (error: { code?: string; message?: string }) =>
  error.code === "23514" ? NAME_ERROR : habitErrorMessage(error);

function refresh(groupId?: string) {
  revalidatePath("/groups");
  revalidatePath("/today");
  if (groupId) revalidatePath(`/groups/${groupId}`);
}

export async function createGroup(_prev: GroupActionState, formData: FormData): Promise<GroupActionState> {
  const name = parseGroupName(String(formData.get("name") ?? ""));
  if (!name.ok) return { status: "error", message: name.error };
  const kind = String(formData.get("kind") ?? "other");
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("create_group", { p_name: name.value, p_kind: isGroupKind(kind) ? kind : "other" });
  if (error || !data) return { status: "error", message: error ? nameErrorMessage(error) : habitErrorMessage(null) };
  refresh();
  redirect(`/groups/${data.id}?invite=1`);
}

export async function renameGroup(groupId: string, _prev: GroupActionState, formData: FormData): Promise<GroupActionState> {
  if (!isUuid(groupId)) return NOT_FOUND;
  const name = parseGroupName(String(formData.get("name") ?? ""));
  if (!name.ok) return { status: "error", message: name.error };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("update_group", { p_group_id: groupId, p_name: name.value });
  if (error) return { status: "error", message: nameErrorMessage(error) };
  refresh(groupId);
  return { status: "saved" };
}

export async function updateGroupSettings(groupId: string, _prev: GroupActionState, formData: FormData): Promise<GroupActionState> {
  if (!isUuid(groupId)) return NOT_FOUND;
  const timezone = String(formData.get("timezone") ?? "");
  const weekStart = String(formData.get("weekStart") ?? "");
  if (!listTimezones().includes(timezone)) return { status: "error", message: "Pick a time zone." };
  if (weekStart !== "0" && weekStart !== "1") return { status: "error", message: "Pick Monday or Sunday." };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("update_group", { p_group_id: groupId, p_timezone: timezone, p_week_start: Number(weekStart) });
  if (error) return { status: "error", message: habitErrorMessage(error) };
  refresh(groupId);
  return { status: "saved" };
}

async function run(groupId: string, call: () => PromiseLike<{ error: { message: string } | null }>): Promise<GroupActionState> {
  const { error } = await call();
  if (error) return { status: "error", message: habitErrorMessage(error), code: code(error.message) };
  refresh(groupId);
  return { status: "saved" };
}

export async function createInvite(groupId: string): Promise<GroupActionState> {
  if (!isUuid(groupId)) return NOT_FOUND;
  const { supabase } = await requireUser();
  return run(groupId, () => supabase.rpc("create_invite", { p_group_id: groupId }));
}

export async function revokeInvites(groupId: string): Promise<GroupActionState> {
  if (!isUuid(groupId)) return NOT_FOUND;
  const { supabase } = await requireUser();
  return run(groupId, () => supabase.rpc("revoke_invites", { p_group_id: groupId }));
}

export async function setMemberRole(groupId: string, userId: string, role: "admin" | "member"): Promise<GroupActionState> {
  if (!isUuid(groupId) || !isUuid(userId)) return NO_MEMBER;
  const { supabase } = await requireUser();
  return run(groupId, () => supabase.rpc("set_member_role", { p_group_id: groupId, p_user_id: userId, p_role: role }));
}

export async function removeMember(groupId: string, userId: string): Promise<GroupActionState> {
  if (!isUuid(groupId) || !isUuid(userId)) return NO_MEMBER;
  const { supabase } = await requireUser();
  return run(groupId, () => supabase.rpc("remove_member", { p_group_id: groupId, p_user_id: userId }));
}

// Leave/Delete return the code so the dialog can switch to the "children would be deleted" step
// (Task 10 adds Export and Move there).
export async function leaveGroup(groupId: string, confirmChildren: boolean): Promise<GroupActionState> {
  if (!isUuid(groupId)) return NOT_FOUND;
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("leave_group", { p_group_id: groupId, p_confirm_children: confirmChildren });
  if (error) return { status: "error", message: habitErrorMessage(error), code: code(error.message) };
  refresh(groupId);
  redirect("/groups");
}

export async function deleteGroup(groupId: string, confirmChildren: boolean): Promise<GroupActionState> {
  if (!isUuid(groupId)) return NOT_FOUND;
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("delete_group", { p_group_id: groupId, p_confirm_children: confirmChildren });
  if (error) return { status: "error", message: habitErrorMessage(error), code: code(error.message) };
  refresh(groupId);
  redirect("/groups");
}
