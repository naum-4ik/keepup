"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isValidEmail } from "@/lib/email";
import { safeNextPath } from "@/lib/paths";
import { requestOrigin } from "@/lib/request-origin";
import type { LoginState } from "./state";

function callbackUrl(origin: string, next: string) {
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function signInWithEmail(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!isValidEmail(email)) return { status: "error", message: "Enter a valid email address.", email };

  const next = safeNextPath(String(formData.get("next") ?? ""));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callbackUrl(await requestOrigin(), next) },
  });
  if (error)
    return { status: "error", message: "Couldn't send the link. Try again in a minute.", email };

  return { status: "sent", message: `Check ${email} for a sign-in link. Open it in this browser.` };
}

export async function signInWithGoogle(formData: FormData) {
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(await requestOrigin(), next) },
  });
  if (error || !data.url) redirect("/auth/error");
  redirect(data.url);
}
