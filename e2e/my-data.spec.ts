import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { completeOnboarding, signIn, signUp, signUpAndOnboard, uniqueEmail } from "./helpers/auth";
import { createGroup, inviteLink, joinByLink } from "./helpers/groups";

test("Settings → Export my data saves everything as one dated JSON file", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/profile/settings");
  const section = page.getByRole("region", { name: "Your data" });
  const [download] = await Promise.all([page.waitForEvent("download"), section.getByRole("button", { name: "Export my data" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^keepup-my-data-\d{4}-\d{2}-\d{2}\.json$/);
  const file = JSON.parse(readFileSync((await download.path())!, "utf8"));
  expect(file.format).toBe("keepup-export-v1");
});

test("Settings → Delete account: the other member becomes admin, the login is gone", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const anna = uniqueEmail("anna");
  await signUp(page, anna);
  await completeOnboarding(page, { name: "Anna" });
  await createGroup(page, "Delete family");
  const groupUrl = page.url();
  const url = await inviteLink(page);
  const benContext = await browser.newContext();
  const ben = await benContext.newPage();
  await joinByLink(ben, url, "Ben");

  await page.goto("/profile/settings");
  await page.getByRole("region", { name: "Your data" }).getByRole("button", { name: "Delete account" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete your account?" });
  await expect(dialog).toContainText("Ben becomes the admin of Delete family.");
  const confirm = dialog.getByRole("button", { name: "Delete", exact: true });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Type “delete” to confirm").fill("delete");
  await expect(confirm).toBeEnabled();
  await confirm.click();

  // The landing page says so (signed out: not sent on to Today).
  await expect(page).toHaveURL(/\/\?deleted=1$/);
  await expect(page.getByRole("status")).toHaveText("Your account and data are deleted.");

  await signIn(page, anna);
  await expect(page.locator("#login-error")).toHaveText("That email and password don't match. Try again.");

  await ben.goto(groupUrl);
  const people = ben.getByRole("listitem").filter({ hasText: "You" });
  await expect(people).toContainText("Admin");
  await expect(ben.getByText("Anna", { exact: true })).toHaveCount(0);
  await benContext.close();
});
