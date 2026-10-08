import "server-only";
import { requireUser } from "@/lib/auth";
import type { AvatarColor } from "@/lib/avatars";
import type { Database } from "@/lib/database.types";
import type { GroupKind } from "@/lib/group-schema";
import { logError } from "@/lib/log";

export type MyGroup = Database["public"]["Functions"]["my_groups"]["Returns"][number];
export type GroupMember = {
  id: string;
  name: string;
  avatar_emoji: string | null;
  avatar_color: AvatarColor | null;
  role: "admin" | "member";
  joined_at: string;
};
export type GroupChild = { id: string; name: string; avatar_emoji: string | null; avatar_color: AvatarColor | null };
export type GroupDetail = {
  id: string;
  name: string;
  kind: GroupKind;
  timezone: string;
  week_start: 0 | 1;
  avatar_emoji: string | null;
  avatar_color: AvatarColor | null;
  my_role: "admin" | "member";
  members: GroupMember[];
  children: GroupChild[];
  invite: { token: string; expires_at: string } | null;
};

// Fail soft: the Groups tab may deploy minutes before its migration (deploy lesson).
export async function getMyGroups(): Promise<MyGroup[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("my_groups");
  if (error) {
    logError("my_groups failed", error.message);
    return [];
  }
  return data ?? [];
}

export async function getGroupDetail(groupId: string): Promise<GroupDetail | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("group_detail", { p_group_id: groupId });
  if (error) {
    logError("group_detail failed", error.message);
    return null;
  }
  return (data as unknown as GroupDetail | null) ?? null;
}
