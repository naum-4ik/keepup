"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { isAvatarColor, isAvatarEmoji } from "@/lib/avatars";
import { parseProfile, readProfileForm, type ProfileFormState } from "@/lib/profile-schema";
import { saveProfile } from "@/lib/profile-update";
import { listTimezones } from "@/lib/timezones";

export async function updateProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const values = readProfileForm(formData);
  const parsed = parseProfile(values, new Set(listTimezones()));
  if (!parsed.ok) return { status: "error", errors: parsed.errors, values };

  const { supabase, userId } = await requireUser();
  const message = await saveProfile(supabase, userId, parsed.value, { markOnboarded: false });
  if (message) return { status: "error", message, values };

  revalidatePath("/", "layout");
  return { status: "saved" };
}

export type AvatarFormState = { status: "idle" } | { status: "saved" } | { status: "error"; message: string };

export async function saveAvatar(_prev: AvatarFormState, formData: FormData): Promise<AvatarFormState> {
  const emoji = String(formData.get("avatarEmoji") ?? "");
  const color = String(formData.get("avatarColor") ?? "");
  // The database only checks the length; the curated set is the app's rule (docs/design.md).
  if (emoji !== "" && !isAvatarEmoji(emoji)) return { status: "error", message: "Pick one of these avatars." };
  if (!isAvatarColor(color)) return { status: "error", message: "Pick a color." };
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_emoji: emoji || null, avatar_color: color })
    .eq("id", userId);
  if (error) return { status: "error", message: "Couldn't save your avatar. Try again." };
  revalidatePath("/", "layout");
  return { status: "saved" };
}
