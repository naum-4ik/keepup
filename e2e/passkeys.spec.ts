import { expect, test, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./helpers/auth";
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
