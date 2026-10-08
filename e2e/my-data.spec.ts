import { execSync } from "node:child_process";
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

  const annaId = sql(`select id from auth.users where email = '${anna}';`);
  expect(signInHistoryOf(annaId, anna)).toBeGreaterThan(0); // sign-up and sign-in rows: the count below means something

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
  // The sign-in history went with the login, and signing out afterwards wrote nothing new.
  expect(signInHistoryOf(annaId, anna)).toBe(0);

  await signIn(page, anna);
  await expect(page.locator("#login-error")).toHaveText("That email and password don't match. Try again.");

  await ben.goto(groupUrl);
  const people = ben.getByRole("listitem").filter({ hasText: "You" });
  await expect(people).toContainText("Admin");
  await expect(ben.getByText("Anna", { exact: true })).toHaveCount(0);
  await benContext.close();
});

// Local stack only: one value from the test database.
function sql(query: string): string {
  return execSync(`docker exec -i supabase_db_keepup psql -U postgres -d postgres -tA -v ON_ERROR_STOP=1`, { input: query, encoding: "utf8" }).trim();
}

// Supabase Auth's sign-in history rows that mention the person by account id or email.
function signInHistoryOf(userId: string, email: string): number {
  if (!/^[0-9a-f-]{36}$/.test(userId) || !/^[a-z0-9.+-]+@example\.com$/.test(email)) throw new Error("Not a test account");
  return Number(sql(`select count(*) from auth.audit_log_entries where payload::text like '%${userId}%' or payload::text like '%${email}%';`));
}
