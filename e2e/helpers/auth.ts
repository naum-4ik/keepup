import { expect, type Page } from "@playwright/test";
import { latestMagicLink } from "./mailpit";

export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export async function signInWithMagicLink(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByRole("status")).toContainText("Check");
  await page.goto(await latestMagicLink(email));
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
    await page.getByRole("button", { name: "Change" }).click();
    await page.getByLabel("Time zone").selectOption(timezone);
  }
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/onboarding\/habits$/);
  await page.getByRole("link", { name: "Skip for now" }).click();
  await expect(page).toHaveURL(/\/today$/);
}

export async function signUpAndOnboard(page: Page): Promise<void> {
  await signInWithMagicLink(page, uniqueEmail());
  await completeOnboarding(page);
}
