import { DISPLAY_NAME_MAX } from "@/lib/profile-schema";

// Onboarding's name suggestion: the Google full_name/name claim, else the email's local part made
// readable ("ana.maria_x" -> "Ana Maria X"). Cut to the column's 40 characters and trimmed again,
// like the signup trigger, so the suggestion is always a valid name. "" when there's nothing to use.
export function suggestDisplayName({ fullName, name, email }: { fullName?: unknown; name?: unknown; email?: unknown }): string {
  const claim = [fullName, name].map(clean).find(Boolean);
  const local = typeof email === "string" ? email.split("@")[0] : "";
  const fromEmail = clean(local.replace(/[._]+/g, " ")).replace(/(^|\s)(\p{Ll})/gu, (_, sp, c: string) => sp + c.toUpperCase());
  return clean([...(claim || fromEmail)].slice(0, DISPLAY_NAME_MAX).join(""));
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}
