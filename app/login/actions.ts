"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { credentialsError, passwordAuthMessage } from "@/lib/password";
import { safeNextPath } from "@/lib/paths";
import { requestOrigin } from "@/lib/request-origin";
import type { LoginState } from "./state";

function callbackUrl(origin: string, next: string) {
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

// Email + password, for both sign-in and sign-up. Email confirmation is off (no email is sent; see
// supabase/config.toml), so a new account is signed in right away.
export async function submitCredentials(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const mode = formData.get("mode") === "signup" ? "signup" : "signin";
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const invalid = credentialsError(email, password, mode);
  if (invalid) return { status: "error", message: invalid.message, field: invalid.field, email, mode };

  const supabase = await createClient();
  const { data, error } =
    mode === "signup"
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const accountExists = error.code === "user_already_exists" || error.code === "email_exists";
    return { status: "error", message: passwordAuthMessage(error), email, mode, accountExists };
  }
  if (!data.session) return { status: "error", message: passwordAuthMessage({}), email, mode };

  redirect(safeNextPath(String(formData.get("next") ?? "")));
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
