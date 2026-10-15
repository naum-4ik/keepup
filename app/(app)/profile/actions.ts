"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { isAvatarEmoji, parseAvatar, type AvatarFormState } from "@/lib/avatars";

export async function saveAvatar(_prev: AvatarFormState, formData: FormData): Promise<AvatarFormState> {
  const { t } = await getT();
  const avatar = parseAvatar(t, formData, isAvatarEmoji);
  if (!avatar.ok) return { status: "error", message: avatar.message };
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_emoji: avatar.emoji, avatar_color: avatar.color })
    .eq("id", userId);
  if (error) return { status: "error", message: "Couldn't save your avatar. Try again." };
  revalidatePath("/", "layout");
  return { status: "saved" };
}
