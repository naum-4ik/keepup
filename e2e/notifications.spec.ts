import { expect, test } from "@playwright/test";
import { signUpAndOnboard } from "./helpers/auth";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

test("Settings: the daily reminder is back with its hint, and the choices stick", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/profile/settings");
  const section = page.getByRole("region", { name: "Notifications" });
  await section.getByRole("button", { name: "What is this?" }).click();
  await expect(section.getByText("When your daily summary arrives.")).toBeVisible();

  await section.getByLabel("Daily reminder").selectOption("7");
  await section.getByRole("checkbox", { name: /Nudges/ }).uncheck();
  await expect(section.getByRole("checkbox", { name: /Nudges/ })).not.toBeChecked();
  await page.waitForLoadState("networkidle"); // both server actions have answered
  await page.reload();
  await expect(section.getByLabel("Daily reminder")).toHaveValue("7");
  await expect(section.getByRole("checkbox", { name: /Nudges/ })).not.toBeChecked();

  await section.getByRole("checkbox", { name: /Approvals/ }).uncheck();
  await expect(section.getByText("Your group can't complete habits that need your approval.")).toBeVisible();
});

test("Pause all, then resume", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/profile/settings");
  const section = page.getByRole("region", { name: "Notifications" });
  await section.getByRole("button", { name: "Until I turn them back on" }).click();
  await expect(section.getByText("Paused until you turn them back on")).toBeVisible();
  await section.getByRole("button", { name: "Resume" }).click();
  await expect(section.getByRole("button", { name: "8 hours" })).toBeVisible();
});

test.describe("on an iPhone", () => {
  test.use({ userAgent: IPHONE });

  test("an iPhone that hasn't installed Keepup sees how to add it", async ({ page }) => {
    await signUpAndOnboard(page);
    await page.goto("/profile/settings");
    await page.getByRole("button", { name: "Turn on reminders" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Add Keepup to your Home Screen" })).toBeVisible();
    await expect(dialog).toContainText("Add to Home Screen");
  });
});

test("the renewed-subscription route refuses signed-out visitors and other sites", async ({ request }) => {
  const data = { endpoint: `https://fcm.googleapis.com/fcm/send/e2e-${Date.now()}`, p256dh: "p", auth: "a" };
  expect((await request.post("/api/push-subscription", { data, maxRedirects: 0 })).status()).toBe(401);
  expect((await request.post("/api/push-subscription", { data, headers: { Origin: "https://evil.example" } })).status()).toBe(403);
});
