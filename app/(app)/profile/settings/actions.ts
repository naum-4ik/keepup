"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
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
