"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isValidEmail } from "@/lib/email";
import { CONFIRM_EMAIL_SENT, RESET_LINK_SENT, RESET_LINK_STALE, credentialsError, isFreshRecovery, newPasswordError, passwordAuthMessage } from "@/lib/password";
import { safeNextPath } from "@/lib/paths";
import { requestOrigin } from "@/lib/request-origin";
import type { LoginState } from "./state";

function callbackUrl(origin: string, next: string) {
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

// Email + password, for both sign-in and sign-up. With email confirmation off (supabase/config.toml and
// the hosted dashboard), a new account is signed in right away; with it on, sign-up asks to confirm first.
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
  if (!data.session) {
    if (mode === "signup") return { status: "confirm", message: CONFIRM_EMAIL_SENT };
    return { status: "error", message: passwordAuthMessage({}), email, mode };
  }

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

// Forgot password. The link goes to /auth/confirm, then to the new-password page. The answer is the
// same whatever Supabase says (unknown address, too soon after the last email), so it never tells
// whether an address has an account.
export async function requestPasswordReset(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!isValidEmail(email)) return { status: "error", message: "Enter a valid email address.", field: "email", email, mode: "signin" };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await requestOrigin()}/auth/confirm?next=/auth/new-password`,
  });
  if (error) console.warn("password reset email not sent", error.code ?? error.status);
  return { status: "reset_sent", message: RESET_LINK_SENT, email };
}

// The new-password page, signed in by the reset link minutes ago (isFreshRecovery); any other session
// would change the password without knowing the current one.
export async function setNewPassword(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const tooShort = newPasswordError(password);
  if (tooShort) return { status: "error", message: tooShort, field: "password", email: "", mode: "signup" };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/auth/error?reason=link");
  if (!isFreshRecovery(data.claims, new Date()))
    return { status: "error", message: RESET_LINK_STALE, field: "password", email: "", mode: "signup" };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { status: "error", message: passwordAuthMessage(error), field: "password", email: "", mode: "signup" };

  redirect("/today");
}
