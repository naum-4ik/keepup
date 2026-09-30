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
  if (mode === "signup" && [...password].length < PASSWORD_MIN)
    return { field: "password", message: `Use at least ${PASSWORD_MIN} characters.` };
  if (mode === "signin" && password === "") return { field: "password", message: "Enter your password." };
  return null;
}

// Sign-up succeeded but Supabase wants the address confirmed first (Confirm email on), so no session yet.
export const CONFIRM_EMAIL_SENT = "Almost done: open the link we emailed you to confirm your address, then sign in.";

const MESSAGES: Record<string, string> = {
  email_not_confirmed: "Confirm your email first: open the link we sent you, then sign in.",
  invalid_credentials: "That email and password don't match. Try again.",
  user_already_exists: "That email already has an account.",
  email_exists: "That email already has an account.",
  weak_password: `Use at least ${PASSWORD_MIN} characters.`,
  over_request_rate_limit: "Too many tries. Wait a minute and try again.",
  email_address_invalid: "Enter a valid email address.",
};

export function passwordAuthMessage(error: { code?: string }): string {
  return (error.code && MESSAGES[error.code]) || "Something went wrong. Try again.";
}
