"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isCelebrationMode } from "@/lib/celebrations";
import { GENERIC_ERROR } from "@/lib/habit-errors";
import type { DeletePreview } from "@/lib/my-data";
import { parseProfile, readProfileForm, type ProfileFormState } from "@/lib/profile-schema";
import { saveProfile } from "@/lib/profile-update";
import { listTimezones } from "@/lib/timezones";
import { logError } from "@/lib/log";

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

// Settings → Celebrations (§9): Full or Subtle.
export async function setCelebrations(mode: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isCelebrationMode(mode)) return { ok: false, message: GENERIC_ERROR };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("set_celebrations", { p_mode: mode });
  if (error) return { ok: false, message: GENERIC_ERROR };
  revalidatePath("/profile/settings");
  return { ok: true };
}

// Settings → Reset my data (owner 2026-10-06): the database clears this person's private habits and
// their history, XP, levels, badges and Inbox (public.reset_my_data). The page then clears what waits
// on the phone and opens Today, which says so calmly.
export async function resetMyData(): Promise<{ ok: true } | { ok: false; message: string }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("reset_my_data");
  if (error) {
    logError("reset my data", error.message);
    return { ok: false, message: GENERIC_ERROR };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// Settings → Your data (M6): everything Keepup keeps about this person, as one JSON object
// (public.export_my_data). The page saves it as a file.
export async function exportMyData(): Promise<{ ok: true; data: unknown } | { ok: false; message: string }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("export_my_data");
  if (error) {
    logError("export my data", error.message);
    return { ok: false, message: GENERIC_ERROR };
  }
  return { ok: true, data };
}

// What deleting the account does to groups: the ones left empty go (with their children), and who
// becomes admin where this person was the last one (public.delete_account_preview).
export async function deleteAccountPreview(): Promise<DeletePreview | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("delete_account_preview");
  if (error) {
    logError("delete account preview", error.message);
    return null;
  }
  return data as DeletePreview;
}

// Deletes the account in one database transaction (public.delete_my_account), login included. The
// session's token still verifies until it expires, but its user is gone: drop the cookies here and
// leave for the landing page, which says so.
export async function deleteMyAccount(): Promise<{ ok: false; message: string }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    logError("delete my account", error.message);
    return { ok: false, message: GENERIC_ERROR };
  }
  await supabase.auth.signOut({ scope: "local" });
  redirect("/?deleted=1");
}
