import { expect, test } from "@playwright/test";
import { TEST_PASSWORD, chooseTimezone, completeOnboarding, signIn, signUp, signUpAndOnboard, uniqueEmail } from "./helpers/auth";

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/today");
  await expect(page).toHaveURL(/\/login\?next=%2Ftoday$/);
});

test("the landing page: one Get started button, and a Sign in link", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Keepup" })).toBeVisible();
  const start = page.getByRole("link", { name: "Get started" });
  const width = (await start.boundingBox())?.width ?? 0;
  expect(width).toBeGreaterThanOrEqual(340); // fills the column (max 384px minus 2 × 16px margins)
  await start.click();
  await expect(page).toHaveURL(/\/signup$/);
  await page.goto("/");
  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("a new user signs in, onboards and lands on Today", async ({ page }) => {
  await signUp(page, uniqueEmail());

  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByLabel("Time zone")).toHaveValue("Europe/Rome"); // detected from the browser
  await expect(page.getByText("Rome", { exact: true })).toBeVisible();

  await completeOnboarding(page, { name: "Ana" });
  await expect(page.getByText("Nothing to do yet")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Today" }),
  ).toHaveAttribute("aria-current", "page");
});

test("a returning user skips onboarding", async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await completeOnboarding(page);

  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/today$/);

  await page.goto("/profile");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);

  await signIn(page, email);
  await expect(page).toHaveURL(/\/today$/);
});

test("password sign-in explains mistakes", async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await completeOnboarding(page);
  await page.goto("/profile");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);

  await signIn(page, email, "not-the-password");
  await expect(page.locator("#login-error")).toHaveText("That email and password don't match. Try again.");
  await expect(page.getByLabel("Email")).toHaveValue(email);

  // Changing the email clears the old error.
  await page.getByRole("button", { name: "Change" }).click();
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator("#login-error")).toHaveText("Enter a valid email address.");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator("#login-error")).toHaveCount(0);
});

test("sign-up explains mistakes and links to sign-in for an existing email", async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await completeOnboarding(page);
  await page.goto("/profile");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/signup");
  await expect(page.getByText("At least 8 characters.")).toBeVisible();
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator("#signup-error")).toHaveText("Use at least 8 characters.");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("short"); // kept, to fix in place

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator("#signup-error")).toContainText("That email already has an account.");
  await page.getByRole("link", { name: "Sign in instead" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("sign-in and sign-up link to each other, and the password can be shown", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await page.getByRole("link", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();

  const password = page.getByLabel("Password", { exact: true });
  await password.fill("secret-words");
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");

  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill("ana@example.com");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByText("Sign in with Google using the same email, or ask Ilya to reset it.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Email me a link" })).toHaveCount(0);
});

test("signing in returns to the page that asked for it", async ({ page }) => {
  const email = uniqueEmail();
  await signUpAndOnboardWith(page, email);
  await page.goto("/profile");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/progress");
  await expect(page).toHaveURL(/\/login\?next=%2Fprogress$/);
  await expect(page.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/signup?next=%2Fprogress");
  await signInHere(page, email);
  await expect(page).toHaveURL(/\/progress$/);
});

async function signInHere(page: import("@playwright/test").Page, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function signUpAndOnboardWith(page: import("@playwright/test").Page, email: string) {
  await signUp(page, email);
  await completeOnboarding(page);
}

test("invalid input keeps what the user typed", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.getByLabel("Display name").fill("x".repeat(41));
  await page.getByRole("button", { name: "Change", exact: true }).click();
  await chooseTimezone(page, "Asia/Tokyo");
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(page.getByText("Keep it to 40 characters.")).toBeVisible();
  await expect(page.getByLabel("Time zone")).toHaveValue("Asia/Tokyo");
  await expect(page.getByLabel("Display name")).toHaveValue("x".repeat(41));
});

test("settings changes show on the profile", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await completeOnboarding(page);

  await page.goto("/profile/settings");
  await expect(page.getByLabel("Daily reminder")).toBeVisible(); // back with reminders (M4)
  await expect(page.getByLabel("Time zone").locator("option:checked")).toHaveText(/^\d\d:\d\d \(Rome\)$/);
  await chooseTimezone(page, "Asia/Tokyo");
  await expect(page.getByText("Changes apply from your next day and week.")).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("Saved");

  await page.goto("/profile");
  await expect(page.getByText("Tokyo · weeks start Sunday")).toBeVisible();
});

test("settings: one row per time, the device link and the (i) hints", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/profile/settings");

  const zone = page.getByLabel("Time zone");
  const options = zone.locator("option");
  expect(await options.count()).toBeLessThan(45); // one row per current time, not every city
  await expect(options.filter({ hasText: "(Kolkata)" })).toHaveText(/^\d\d:\d\d \(Kolkata\)$/);

  await expect(page.getByRole("button", { name: /Use this device's time zone/ })).toHaveCount(0); // already Rome
  await chooseTimezone(page, "Asia/Tokyo");
  await page.getByRole("button", { name: "Use this device's time zone (Rome)" }).click();
  await expect(zone).toHaveValue("Europe/Rome");

  const hint = page.getByText("Pick the time it is where you are now. Your days start at midnight there.");
  await expect(hint).toBeHidden();
  await page.getByRole("button", { name: "What is this?" }).first().click();
  await expect(hint).toBeVisible();
});

test("the first day of the week can be changed in settings", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await completeOnboarding(page);
  await page.goto("/profile/settings");
  await expect(page.getByLabel("Week starts on")).toHaveValue("0"); // detected from the browser locale (en-US)
  await page.getByLabel("Week starts on").selectOption("1");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("Saved");
  await page.reload();
  await expect(page.getByLabel("Week starts on")).toHaveValue("1");
});

test("the profile shows the app version and links to what's new", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await completeOnboarding(page);

  await page.goto("/profile");
  const version = page.getByRole("link", { name: /^v\d+\.\d+\.\d+ · (dev|[0-9a-f]{7})$/ });
  await expect(version).toBeVisible();
  await version.click();
  await expect(page.getByRole("heading", { name: "What's new" })).toBeVisible();
  // Written for people: versions and plain lines, not commit hashes or PR links.
  await expect(page.getByRole("heading", { name: /^Version \d+\.\d+\.\d+$/ }).first()).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/#\d+|Changelog/);
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
  await signUp(page, uniqueEmail());
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
  await expect(page.getByRole("main").getByRole("status")).toHaveText("Saved");
});

test("Profile is a list: Achievements, Settings, What's new and Groups, then Sign out", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await completeOnboarding(page);
  await page.goto("/profile");
  const list = page.getByRole("navigation", { name: "Account" });
  await expect(list.getByRole("link")).toHaveText(["Achievements", "Settings", "What's new", "Groups"]);
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await list.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/profile\/settings$/);
});
