"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LOCALE_COOKIE, asLocale, enabledLocales } from "@/i18n/config";
import { requireUser } from "@/lib/auth";
import { isCelebrationMode } from "@/lib/celebrations";
import { genericError } from "@/lib/habit-errors";
import { getT } from "@/lib/i18n/server";
import type { DeletePreview } from "@/lib/my-data";
import { errorText } from "@/lib/field-error";
import { parseProfileSetting } from "@/lib/profile-schema";
import { listTimezones } from "@/lib/timezones";
import { logError, track } from "@/lib/log";
import { LOCALES } from "@/supabase/functions/_shared/i18n";

const COOKIE_OPTIONS = { maxAge: 60 * 60 * 24 * 365, path: "/", sameSite: "lax" } as const;

export type SettingResult = { ok: true } | { ok: false; message: string };

// Settings → Your profile: one field at a time, saved as it changes (the name with its Save).
export async function saveProfileSetting(field: string, value: string): Promise<SettingResult> {
  const { t } = await getT();
  const parsed = parseProfileSetting(field, value, new Set(listTimezones()));
  if (!parsed.ok) return { ok: false, message: errorText(t, parsed.error) };
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("profiles").update(parsed.update).eq("id", userId);
  if (error) {
    logError("save profile setting", error.message);
    // 23514 = check_violation: a zone the list has but Postgres doesn't know.
    if (error.code === "23514") return { ok: false, message: t("profile.errors.timezoneUnsupported") };
    return { ok: false, message: t(field === "displayName" ? "settings.status.failedSave" : "settings.status.failedPick") };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// Settings → Celebrations (§9): Full or Subtle.
export async function setCelebrations(mode: string): Promise<SettingResult> {
  const { t } = await getT();
  if (!isCelebrationMode(mode)) return { ok: false, message: t("errors.invalid_choice") };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("set_celebrations", { p_mode: mode });
  if (error) return { ok: false, message: t("settings.status.failedPick") };
  revalidatePath("/profile/settings");
  return { ok: true };
}

// Settings → Language: saved on the profile (the truth, for every device and for pushes), on the login
// for emails, and in this device's cookie (what the next page renders in).
export async function setLanguage(locale: string): Promise<SettingResult> {
  const { t } = await getT();
  const chosen = asLocale(locale, enabledLocales());
  if (!chosen) return { ok: false, message: t("errors.invalid_choice") };
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("profiles").update({ locale: chosen }).eq("id", userId);
  if (error) {
    logError("set language", error.message);
    return { ok: false, message: t("settings.status.failedPick") };
  }
  // Emails read the login's metadata; a failure here mustn't undo the change.
  try {
    const { error: authError } = await supabase.auth.updateUser({ data: { locale: chosen } });
    if (authError) logError("set language: login metadata", authError.message);
  } catch (e) {
    logError("set language: login metadata", e instanceof Error ? e.message : String(e));
  }
  (await cookies()).set(LOCALE_COOKIE, chosen, COOKIE_OPTIONS);
  revalidatePath("/", "layout");
  return { ok: true };
}

// The app layout's LocaleSync: fills an unset profile with the phone's language (any of LOCALES, enabled
// or not) and points this device's cookie at the profile's language. Never overwrites a chosen language.
export async function syncLocale(save: string | null, cookie: string | null): Promise<{ ok: boolean }> {
  const toSave = asLocale(save, [...LOCALES]);
  const toCookie = asLocale(cookie, enabledLocales());
  const { supabase, userId } = await requireUser();
  if (toSave) {
    const { error } = await supabase.from("profiles").update({ locale: toSave }).eq("id", userId).is("locale", null);
    if (error) {
      logError("sync language", error.message);
      return { ok: false };
    }
  }
  if (toCookie) (await cookies()).set(LOCALE_COOKIE, toCookie, COOKIE_OPTIONS);
  return { ok: true };
}

// Settings → Reset my data (owner 2026-10-06): the database clears this person's private habits and
// their history, XP, levels, badges and Inbox (public.reset_my_data). The page then clears what waits
// on the phone and opens Today, which says so calmly.
export async function resetMyData(): Promise<{ ok: true } | { ok: false; message: string }> {
  const { t } = await getT();
  const { supabase, who } = await requireUser();
  const { error } = await supabase.rpc("reset_my_data");
  if (error) {
    logError("reset my data", error.message);
    return { ok: false, message: genericError(t) };
  }
  track("data_reset", who);
  revalidatePath("/", "layout");
  return { ok: true };
}

// Settings → Your data (M6): everything Keepup keeps about this person, as one JSON object
// (public.export_my_data). The page saves it as a file.
export async function exportMyData(): Promise<{ ok: true; data: unknown } | { ok: false; message: string }> {
  const { t } = await getT();
  const { supabase, who } = await requireUser();
  const { data, error } = await supabase.rpc("export_my_data");
  if (error) {
    logError("export my data", error.message);
    return { ok: false, message: genericError(t) };
  }
  track("data_exported", who);
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
  const { t } = await getT();
  const { supabase, who } = await requireUser();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    logError("delete my account", error.message);
    return { ok: false, message: genericError(t) };
  }
  track("account_deleted", who);
  await supabase.auth.signOut({ scope: "local" });
  redirect("/?deleted=1");
}
