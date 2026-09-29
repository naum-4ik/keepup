import { expect, test } from "@playwright/test";
import { completeOnboarding, signInWithMagicLink, signUpAndOnboard, uniqueEmail } from "./helpers/auth";

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/today");
  await expect(page).toHaveURL(/\/login\?next=%2Ftoday$/);
});

test("a new user signs in, onboards and lands on Today", async ({ page }) => {
  await signInWithMagicLink(page, uniqueEmail());

  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByLabel("Time zone")).toHaveValue("Europe/Rome"); // detected from the browser

  await completeOnboarding(page, { name: "Ana" });
  await expect(page.getByText("Nothing to do yet")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Today" }),
  ).toHaveAttribute("aria-current", "page");
});

test("a returning user skips onboarding", async ({ page }) => {
  const email = uniqueEmail();
  await signInWithMagicLink(page, email);
  await completeOnboarding(page);

  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/today$/);

  await page.goto("/profile");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);

  await signInWithMagicLink(page, email);
  await expect(page).toHaveURL(/\/today$/);
});

test("invalid input keeps what the user typed", async ({ page }) => {
  await signInWithMagicLink(page, uniqueEmail());
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.getByLabel("Display name").fill("x".repeat(41));
  await page.getByLabel("Time zone").selectOption("Asia/Tokyo");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("Keep it to 40 characters.")).toBeVisible();
  await expect(page.getByLabel("Time zone")).toHaveValue("Asia/Tokyo");
  await expect(page.getByLabel("Display name")).toHaveValue("x".repeat(41));
});

test("settings changes show on the profile", async ({ page }) => {
  await signInWithMagicLink(page, uniqueEmail());
  await completeOnboarding(page, { hour: "21" });

  await page.goto("/profile/settings");
  await page.getByLabel("Daily reminder").selectOption("7");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");

  await page.goto("/profile");
  await expect(page.getByText("reminders at 07:00")).toBeVisible();
});

test("the first day of the week can be changed in settings", async ({ page }) => {
  await signInWithMagicLink(page, uniqueEmail());
  await completeOnboarding(page);
  await page.goto("/profile/settings");
  await expect(page.getByLabel("Week starts on")).toHaveValue("0"); // detected from the browser locale (en-US)
  await page.getByLabel("Week starts on").selectOption("1");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
  await page.reload();
  await expect(page.getByLabel("Week starts on")).toHaveValue("1");
});

test("the profile shows the app version and links to what's new", async ({ page }) => {
  await signInWithMagicLink(page, uniqueEmail());
  await completeOnboarding(page);

  await page.goto("/profile");
  const version = page.getByRole("link", { name: /^v\d+\.\d+\.\d+ · (dev|[0-9a-f]{7})$/ });
  await expect(version).toBeVisible();
  await version.click();
  await expect(page.getByRole("heading", { name: "Changelog" })).toBeVisible();
});

test("a broken sign-in link shows a helpful error", async ({ page }) => {
  await page.goto("/auth/callback?code=not-a-real-code");
  await expect(page).toHaveURL(/\/auth\/error$/);
  await expect(page.getByText("same browser")).toBeVisible();
});

test("Google sign-in denied or disallowed shows a helpful error", async ({ page }) => {
  await page.goto("/auth/error?reason=denied");
  await expect(page.getByText("cancelled")).toBeVisible();
  await expect(page.getByText("same browser")).not.toBeVisible();
});

const EXPIRED_ERROR_QUERY = "error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";

test("an expired magic link on the landing page explains itself", async ({ page }) => {
  await page.goto(`/?${EXPIRED_ERROR_QUERY}`);
  await expect(page).toHaveURL(/\/auth\/error\?reason=expired$/);
  await expect(page.getByText("already used or has expired")).toBeVisible();
  await expect(page.getByText("same browser")).toBeVisible();
});

test("an expired magic link on the login page explains itself", async ({ page }) => {
  await page.goto("/login?error=access_denied&error_code=otp_expired");
  await expect(page).toHaveURL(/\/auth\/error\?reason=expired$/);
  await expect(page.getByText("already used or has expired")).toBeVisible();
});

test("an expired magic link at the callback explains itself", async ({ page }) => {
  await page.goto("/auth/callback?error=access_denied&error_code=otp_expired");
  await expect(page).toHaveURL(/\/auth\/error\?reason=expired$/);
  await expect(page.getByText("already used or has expired")).toBeVisible();
});

test("a signed-in user clicking a stale link still lands on Today", async ({ page }) => {
  await signInWithMagicLink(page, uniqueEmail());
  await completeOnboarding(page);

  await page.goto("/?error=access_denied&error_code=otp_expired");
  await expect(page).toHaveURL(/\/today$/);
});

test("saving settings twice confirms both saves", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/profile/settings");
  await page.getByLabel("Display name").fill("Bea");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible({ timeout: 5000 });

  await page.getByLabel("Display name").fill("Bee");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Saved");
});
