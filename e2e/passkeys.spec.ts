import { devices, expect, test, type Page } from "@playwright/test";
import { completeOnboarding, signInWithMagicLink, signUpAndOnboard, uniqueEmail } from "./helpers/auth";
import { createHabit } from "./helpers/habits";

// A CDP virtual authenticator stands in for Face ID: it answers every WebAuthn prompt with a
// verified user. It lives as long as the page, so register → sign out → sign in share it.
async function addVirtualAuthenticator(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  });
}

test("set up Face ID, sign in with it, then remove it", async ({ page }) => {
  await addVirtualAuthenticator(page);
  await signUpAndOnboard(page);

  await page.goto("/profile/settings");
  const card = page.getByRole("region", { name: "Face ID sign-in" });
  await expect(card.getByText("Sign in with Face ID next time.")).toBeVisible();
  await card.getByRole("button", { name: "Set up Face ID" }).click();
  await expect(card.getByRole("button", { name: "Added" })).toBeVisible();
  const devices = card.getByRole("list", { name: "Face ID devices" }).getByRole("listitem");
  await expect(devices).toHaveCount(1);
  await expect(devices.first()).toContainText("Android Chrome");

  await page.goto("/profile");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in with Face ID" }).click();
  await expect(page).toHaveURL(/\/today$/);

  await page.goto("/profile/settings");
  await expect(devices.first()).toContainText("Last used");
  await card.getByRole("button", { name: /^Remove / }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Remove Android Chrome?");
  await dialog.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(card.getByRole("list", { name: "Face ID devices" })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Set up Face ID" })).toBeVisible();
});

test("the Face ID prompt on Today goes away with Not now", async ({ page }) => {
  await addVirtualAuthenticator(page);
  await signUpAndOnboard(page);

  const prompt = page.getByRole("region", { name: "Sign in faster with Face ID" });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "Not now" }).click();
  await expect(prompt).toBeHidden();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect(prompt).toBeHidden();
});

test("the Face ID prompt on Today sets up a passkey inline", async ({ page }) => {
  await addVirtualAuthenticator(page);
  await signUpAndOnboard(page);

  const prompt = page.getByRole("region", { name: "Sign in faster with Face ID" });
  await prompt.getByRole("button", { name: "Set up" }).click();
  await expect(page.getByText("Face ID is set up.")).toBeVisible();

  await page.goto("/profile/settings");
  await expect(page.getByRole("list", { name: "Face ID devices" }).getByRole("listitem")).toHaveCount(1);
});

test("Face ID stays out of the way while the first check-in tip shows", async ({ page }) => {
  await addVirtualAuthenticator(page);
  await signUpAndOnboard(page);
  await createHabit(page, { title: "Read", count: 1, period: "day" });
  await expect(page.getByText("Tap when you've done it")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("region", { name: "Sign in faster with Face ID" })).toHaveCount(0);
});

test("Face ID sign-in hides on a host that isn't the passkey RP ID", async ({ page }) => {
  await page.goto("http://127.0.0.1:3000/login");
  await expect(page.getByRole("button", { name: "Email me a link" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in with Face ID" })).toHaveCount(0);
});

test("Face ID sign-in with no passkey on this device shows no error, just a hint", async ({ page }) => {
  await addVirtualAuthenticator(page); // an authenticator with no Keepup credential on it
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in with Face ID" }).click();
  await expect(page.getByText("No Face ID set up on this device?")).toBeVisible();
  await expect(page.getByText("Couldn't sign in with Face ID")).toHaveCount(0);
  await expect(page).toHaveURL(/\/login/);
});

test("a failed Face ID list load offers a retry instead of set-up", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.route("**/auth/v1/passkeys", (route) => route.abort("failed"));
  await page.goto("/profile/settings");
  const card = page.getByRole("region", { name: "Face ID sign-in" });
  await expect(card.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Set up Face ID" })).toHaveCount(0);

  await page.unroute("**/auth/v1/passkeys");
  await card.getByRole("button", { name: "Retry" }).click();
  await expect(card.getByRole("button", { name: "Set up Face ID" })).toBeVisible();
});

test("a returning user's check-in doesn't hide the Face ID prompt", async ({ page, browser }) => {
  // First device: the new user sees the tip and checks in, so the tip is behind them.
  const email = uniqueEmail();
  await signInWithMagicLink(page, email);
  await completeOnboarding(page);
  await createHabit(page, { title: "Drink water", count: 3, period: "day" });
  await page.getByRole("button", { name: "Check in: Drink water" }).click();
  await expect(page.getByText("1 / 3 today")).toBeVisible();

  // Second device: no tip (they've checked in before); a check-in there leaves the prompt alone.
  const context = await browser.newContext({ ...devices["Pixel 7"], baseURL: "http://localhost:3000", timezoneId: "Europe/Rome" });
  const other = await context.newPage();
  await signInWithMagicLink(other, email);
  await expect(other).toHaveURL(/\/today$/);
  await expect(other.getByText("Tap when you've done it")).toHaveCount(0);
  await other.getByRole("button", { name: "Check in: Drink water" }).click();
  await expect(other.getByText("2 / 3 today")).toBeVisible();
  await other.reload();
  await expect(other.getByRole("region", { name: "Sign in faster with Face ID" })).toBeVisible();
  await context.close();
});
