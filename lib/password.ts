import { isValidEmail } from "@/lib/email";
import type { T } from "@/supabase/functions/_shared/i18n";

// Matches Supabase Auth's minimum_password_length (supabase/config.toml and the hosted dashboard).
export const PASSWORD_MIN = 8;

export type CredentialsMode = "signin" | "signup";

export type CredentialsField = "email" | "password";

// Checked before calling Supabase, so the common mistakes get a message (and the right field outlined)
// without a round trip.
export function credentialsError(
  t: T,
  email: string,
  password: string,
  mode: CredentialsMode,
): { field: CredentialsField; message: string } | null {
  if (!isValidEmail(email)) return { field: "email", message: t("auth.emailInvalid") };
  if (mode === "signup") {
    const tooShort = newPasswordError(t, password);
    if (tooShort) return { field: "password", message: tooShort };
  }
  if (mode === "signin" && password === "") return { field: "password", message: t("auth.passwordRequired") };
  return null;
}

// A password being set (sign-up or a reset): the same minimum as Supabase, counted in characters.
export function newPasswordError(t: T, password: string): string | null {
  return [...password].length < PASSWORD_MIN ? t("auth.passwordMin", { min: PASSWORD_MIN }) : null;
}

// Setting a new password without the current one is allowed only right after a reset (or confirm)
// link: the session's amr must hold "recovery" (PKCE code exchange) or "otp" (token_hash verifyOtp)
// from the last 15 minutes. A normal password, Google or demo session never qualifies, so a stolen
// cookie or an unlocked phone can't change the password.
export const RECOVERY_WINDOW_SECONDS = 15 * 60;

type AuthClaims = { amr?: unknown; is_anonymous?: unknown } | null | undefined;

export function isFreshRecovery(claims: AuthClaims, now: Date): boolean {
  if (!claims || claims.is_anonymous === true || !Array.isArray(claims.amr)) return false;
  const nowSeconds = now.getTime() / 1000;
  return claims.amr.some(
    (entry: { method?: unknown; timestamp?: unknown }) =>
      (entry?.method === "recovery" || entry?.method === "otp") &&
      typeof entry.timestamp === "number" &&
      nowSeconds - entry.timestamp <= RECOVERY_WINDOW_SECONDS,
  );
}

// What Supabase Auth's error codes say. weak_password and email_address_invalid reuse the form checks' lines.
const MESSAGE_KEYS: Record<string, string> = {
  email_not_confirmed: "auth.emailNotConfirmed",
  invalid_credentials: "auth.invalidCredentials",
  user_already_exists: "auth.accountExists",
  email_exists: "auth.accountExists",
  weak_password: "auth.passwordMin",
  same_password: "auth.samePassword",
  over_request_rate_limit: "auth.rateLimited",
  email_address_invalid: "auth.emailInvalid",
};

export function passwordAuthMessage(t: T, error: { code?: string }): string {
  const key = error.code && MESSAGE_KEYS[error.code];
  return key ? t(key, { min: PASSWORD_MIN }) : t("errors.generic");
}
