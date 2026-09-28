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

export async function completeOnboarding(
  page: Page,
  { name = "Ana", timezone = "Europe/Rome", hour = "21" }: { name?: string; timezone?: string; hour?: string } = {},
): Promise<void> {
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Display name").fill(name);
  await page.getByLabel("Time zone").selectOption(timezone);
  await page.getByLabel("Daily reminder").selectOption(hour);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/today$/);
}
