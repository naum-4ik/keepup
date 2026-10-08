import { expect, test, type Page } from "@playwright/test";
import { completeOnboarding, signIn, signUp, TEST_PASSWORD, uniqueEmail } from "./helpers/auth";
import { localAdmin } from "./helpers/groups";
import { latestMailLink, mailCount } from "./helpers/mail";

const NEW_PASSWORD = "NewPassword123";
const SENT = "If that email has an account, a reset link is on its way.";

async function signUpOnboardAndSignOut(page: Page, email: string): Promise<void> {
  await signUp(page, email);
  await completeOnboarding(page);
  await page.goto("/profile");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function askForResetLink(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByRole("status").first()).toHaveText(SENT);
  await expect(page.getByText("Or sign in with Google using the same email.")).toBeVisible();
}

async function chooseNewPassword(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/auth\/new-password$/);
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
  await page.getByLabel("New password").fill("short");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.locator("#new-password-error")).toHaveText("Use at least 8 characters.");
  await page.getByLabel("New password").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL(/\/today$/);
}

test("forgot password: the emailed link sets a new one, and only the new one works", async ({ page }) => {
  const email = uniqueEmail();
  await signUpOnboardAndSignOut(page, email);

  await askForResetLink(page, email);
  // Either path into /auth/confirm: Keepup's template (token_hash) once the stack has loaded
  // supabase/config.toml's templates, or Supabase's default (/auth/v1/verify → ?code=, PKCE).
  await page.goto(await latestMailLink(email));
  await chooseNewPassword(page);

  await page.goto("/profile");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);

  await signIn(page, email, TEST_PASSWORD);
  await expect(page.locator("#login-error")).toHaveText("That email and password don't match. Try again.");
  await signIn(page, email, NEW_PASSWORD);
  await expect(page).toHaveURL(/\/today$/);
});

test("forgot password: from the password step it also sends at once", async ({ page }) => {
  const email = uniqueEmail();
  await signUpOnboardAndSignOut(page, email);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByRole("status").first()).toHaveText(SENT);
  await expect.poll(() => mailCount(email)).toBe(1);
});

test("forgot password: with no email typed it asks for one and sends nothing", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByText("Type your email above, then tap Forgot password? again.")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeFocused();
  // The hint belongs to the email field: a screen reader reads it there.
  await expect(page.getByLabel("Email")).toHaveAccessibleDescription("Type your email above, then tap Forgot password? again.");
  await expect(page.getByText(SENT)).toHaveCount(0);
});

test("forgot password: while sending, the button keeps focus and a second tap sends nothing more", async ({ page }) => {
  const email = uniqueEmail();
  await signUpOnboardAndSignOut(page, email);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  // Hold the reset request (a server action posted to /login) until the second tap.
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/login", async (route) => {
    if (route.request().method() === "POST" && route.request().headers()["next-action"]) await held;
    await route.fallback();
  });
  const forgot = page.getByRole("button", { name: /Forgot password\?|Sending…/ });
  await forgot.focus();
  await page.keyboard.press("Enter");
  await expect(forgot).toHaveText("Sending…");
  await expect(forgot).toHaveAttribute("aria-disabled", "true");
  await expect(forgot).toBeFocused();
  await page.keyboard.press("Enter"); // guarded: no second request
  release();
  await expect(page.getByRole("status").first()).toHaveText(SENT);
  await expect(forgot).toBeFocused();
  await page.waitForTimeout(1500);
  expect(await mailCount(email)).toBe(1);
});

test("forgot password: an unknown email gets the same answer, and no email", async ({ page }) => {
  const email = uniqueEmail("nobody");
  await askForResetLink(page, email);
  // Give a (wrongly) sent email time to arrive before saying there is none.
  await page.waitForTimeout(1500);
  expect(await mailCount(email)).toBe(0);
});

test("a token-hash reset link works on another device", async ({ page, browser }) => {
  const email = uniqueEmail();
  await signUpOnboardAndSignOut(page, email);

  // What Keepup's recovery template links to (supabase/templates/recovery.html).
  const { url, key } = localAdmin();
  const res = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "recovery", email }),
  });
  expect(res.ok, await res.clone().text()).toBe(true);
  const { hashed_token } = (await res.json()) as { hashed_token: string };

  const link = `/auth/confirm?token_hash=${hashed_token}&type=recovery&next=/auth/new-password`;
  const phone = await browser.newContext();
  const phonePage = await phone.newPage();
  await phonePage.goto(link);
  await chooseNewPassword(phonePage);
  await phone.close();

  // A used link doesn't work twice.
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto(link);
  await expect(otherPage).toHaveURL(/\/auth\/error\?reason=link$/);
  await expect(otherPage.getByRole("heading", { name: "That link didn't work" })).toBeVisible();
  await other.close();
});

test("the new-password page sends a signed-out visitor to sign in", async ({ page }) => {
  await page.goto("/auth/new-password");
  await expect(page).toHaveURL(/\/login$/);
});

test("a normal sign-in can't set a new password without the current one", async ({ page }) => {
  const email = uniqueEmail();
  await signUpOnboardAndSignOut(page, email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/today$/);

  await page.goto("/auth/new-password");
  await expect(page).toHaveURL(/\/auth\/error\?reason=link$/);
  await expect(page.getByRole("heading", { name: "That link didn't work" })).toBeVisible();
});
