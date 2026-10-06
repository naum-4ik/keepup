import { execSync } from "node:child_process";
import { expect, type Page } from "@playwright/test";

export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export const TEST_PASSWORD = "correct-horse-42";

// Creates the account with email + password (no email is sent; confirmation is off).
// `startOnSignupPage`: the page is already on /signup (e.g. with ?next=), so don't navigate.
export async function signUp(page: Page, email: string, { startOnSignupPage = false } = {}): Promise<void> {
  if (!startOnSignupPage) await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).not.toHaveURL(/\/login/);
  quietCelebrations(email);
}

// Celebrations for test accounts (M5): every account made here starts on Subtle, a toast that never
// covers a control, so the suite's other tests run as before. Tests about the full-screen moment
// switch it to Full in Settings. Local stack only.
export function quietCelebrations(rawEmail: string): void {
  const email = rawEmail.toLowerCase();
  if (!/^[a-z0-9.+-]+@example\.com$/.test(email)) return; // not a generated test account: leave it on Full
  execSync(`docker exec -i supabase_db_keepup psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q`, {
    input: `update public.profiles set celebrations = 'subtle' where id = (select id from auth.users where email = '${email}');`,
    stdio: ["pipe", "ignore", "inherit"],
  });
}

export async function setCelebrations(page: Page, mode: "full" | "subtle"): Promise<void> {
  await page.goto("/profile/settings");
  const section = page.getByRole("region", { name: "Celebrations settings" });
  await section.getByRole("radiogroup", { name: "Celebrations" }).getByRole("radio", { name: mode === "full" ? "Full" : "Subtle" }).check();
  await expect(section).toContainText("Saved");
}

// Email first, then the password (the sign-in screen asks one at a time).
export async function signIn(page: Page, email: string, password = TEST_PASSWORD): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

// Picks a time zone row by the zone it saves (e.g. "Asia/Tokyo", the familiar city for its time).
export async function chooseTimezone(page: Page, zone: string): Promise<void> {
  await page.getByLabel("Time zone").selectOption(zone);
  await expect(page.getByLabel("Time zone")).toHaveValue(zone);
}

// Step 1 with the detected values (optionally a different time zone via "Change") and no purpose
// (or the `purpose` chip, e.g. "My family"),
// then "Skip for now" on step 2, so the user lands on an empty Today. `invited`: the user came from
// an invite, so the URLs carry ?joined=<group> and step 2's button is "Skip".
export async function completeOnboarding(
  page: Page,
  { name = "Ana", timezone, invited = false, purpose }: { name?: string; timezone?: string; invited?: boolean; purpose?: string } = {},
): Promise<void> {
  const joined = invited ? "\\?joined=[0-9a-f-]{36}" : "";
  await expect(page).toHaveURL(new RegExp(`/onboarding${joined}$`));
  await page.getByLabel("Display name").fill(name);
  if (timezone) {
    await page.getByRole("button", { name: "Change", exact: true }).click();
    await chooseTimezone(page, timezone);
  }
  if (purpose) {
    const chip = page.getByRole("button", { name: purpose, exact: true });
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
  }
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/onboarding/habits${joined}$`));
  await page.getByRole("link", { name: invited ? "Skip" : "Skip for now", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/today${joined}$`));
}

export async function signUpAndOnboard(page: Page): Promise<void> {
  await signUp(page, uniqueEmail());
  await completeOnboarding(page);
}
