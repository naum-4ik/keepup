import { expect, type Page } from "@playwright/test";

export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export const TEST_PASSWORD = "correct-horse-42";

// Creates the account with email + password (no email is sent; confirmation is off).
export async function signUp(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function signIn(page: Page, email: string, password = TEST_PASSWORD): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

// Picks a time zone row by the zone it saves (e.g. "Asia/Tokyo", the familiar city for its time).
export async function chooseTimezone(page: Page, zone: string): Promise<void> {
  await page.getByLabel("Time zone").selectOption(zone);
  await expect(page.getByLabel("Time zone")).toHaveValue(zone);
}

// Step 1 with the detected values (optionally a different time zone via "Change") and no purpose,
// then "Skip for now" on step 2, so the user lands on an empty Today.
export async function completeOnboarding(
  page: Page,
  { name = "Ana", timezone }: { name?: string; timezone?: string } = {},
): Promise<void> {
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Display name").fill(name);
  if (timezone) {
    await page.getByRole("button", { name: "Change", exact: true }).click();
    await chooseTimezone(page, timezone);
  }
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/onboarding\/habits$/);
  await page.getByRole("link", { name: "Skip for now" }).click();
  await expect(page).toHaveURL(/\/today$/);
}

export async function signUpAndOnboard(page: Page): Promise<void> {
  await signUp(page, uniqueEmail());
  await completeOnboarding(page);
}
