import { isValidEmail } from "@/lib/email";

// Matches Supabase Auth's minimum_password_length (supabase/config.toml and the hosted dashboard).
export const PASSWORD_MIN = 8;

export type CredentialsMode = "signin" | "signup";

export type CredentialsField = "email" | "password";

// Checked before calling Supabase, so the common mistakes get a message (and the right field outlined)
// without a round trip.
export function credentialsError(
  email: string,
  password: string,
  mode: CredentialsMode,
): { field: CredentialsField; message: string } | null {
  if (!isValidEmail(email)) return { field: "email", message: "Enter a valid email address." };
  if (mode === "signup") {
    const tooShort = newPasswordError(password);
    if (tooShort) return { field: "password", message: tooShort };
  }
  if (mode === "signin" && password === "") return { field: "password", message: "Enter your password." };
  return null;
}

// A password being set (sign-up or a reset): the same minimum as Supabase, counted in characters.
export function newPasswordError(password: string): string | null {
  return [...password].length < PASSWORD_MIN ? `Use at least ${PASSWORD_MIN} characters.` : null;
}

// Sign-up succeeded but Supabase wants the address confirmed first (Confirm email on), so no session yet.
export const CONFIRM_EMAIL_SENT = "Almost done: open the link we emailed you to confirm your address, then sign in.";

// Said for every valid email, so the reset form never tells whether an address has an account.
export const RESET_LINK_SENT = "If that email has an account, a reset link is on its way.";

const MESSAGES: Record<string, string> = {
  email_not_confirmed: "Confirm your email first: open the link we sent you, then sign in.",
  invalid_credentials: "That email and password don't match. Try again.",
  user_already_exists: "That email already has an account.",
  email_exists: "That email already has an account.",
  weak_password: `Use at least ${PASSWORD_MIN} characters.`,
  same_password: "That's the password you have now. Choose a new one.",
  over_request_rate_limit: "Too many tries. Wait a minute and try again.",
  email_address_invalid: "Enter a valid email address.",
};

export function passwordAuthMessage(error: { code?: string }): string {
  return (error.code && MESSAGES[error.code]) || "Something went wrong. Try again.";
}
