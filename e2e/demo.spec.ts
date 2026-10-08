import { expect, test } from "@playwright/test";
import { completeOnboarding, signUp, TEST_PASSWORD, uniqueEmail } from "./helpers/auth";
import { createGroup, inviteLink } from "./helpers/groups";

const BANNER = "You're in the demo. Data resets after 24 hours.";
const OFF = "That's off in the demo.";

// One Try it per test: each spends one of the local anonymous sign-ins (30 an hour per IP).
test("Try it: a full account in under 5 seconds, with a check-in to approve", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("By continuing, you agree to the Privacy Policy")).toBeVisible();
  const started = Date.now();
  // The anonymous sign-in runs in the browser (each visitor's own IP against Supabase's per-IP limit).
  const signIn = page.waitForRequest((r) => r.method() === "POST" && r.url().includes("/auth/v1/signup"));
  await page.getByRole("button", { name: "Try the demo" }).click();
  await signIn;
  await expect(page.getByRole("button", { name: "Check in: Read", exact: true })).toBeVisible({ timeout: 5000 });
  expect(Date.now() - started).toBeLessThan(5000);
  await expect(page).toHaveURL(/\/today/);

  await page.goto("/inbox");
  // exact: "Approve" is also a substring of "Not approved".
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Nothing waiting for you.")).toBeVisible();

  // The banner on every screen; what the demo can't do says so instead.
  await page.goto("/today");
  await expect(page.getByText(BANNER)).toBeVisible();
  await page.goto("/profile");
  await expect(page.getByText(BANNER)).toBeVisible();
  // The policy opens in the demo too (the consent line under Try the demo points at it).
  await page.getByRole("link", { name: "Privacy Policy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { name: "Privacy Policy", level: 1 })).toBeVisible();

  await page.goto("/groups");
  await page.getByRole("link", { name: /Family/ }).first().click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}/);
  await expect(page.getByText(BANNER)).toBeVisible();
  await expect(page.getByText(OFF)).toBeVisible();
  await expect(page.getByRole("button", { name: /invite link/i })).toHaveCount(0);

  await page.getByRole("link", { name: /Nova/ }).first().click();
  await page.getByRole("link", { name: "Open Nova's view" }).click();
  await expect(page).toHaveURL(/\/kids\/[0-9a-f-]{36}\/play$/);
  await expect(page.getByText(BANNER)).toBeVisible();

  await page.goto("/profile/settings");
  await expect(page.getByRole("region", { name: "Notifications" }).getByText(OFF)).toBeVisible();
  await expect(page.getByRole("button", { name: "Turn on reminders" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete account" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Export my data" })).toBeVisible();

  // The banner's Sign in leaves the demo: the session is gone.
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/today");
  await expect(page).toHaveURL(/\/login/);
});

test("Try the demo waits until the page is ready", async ({ browser }) => {
  // No scripts: what the page shows before it is ready.
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  const button = page.getByRole("button", { name: "Loading…" });
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute("aria-disabled", "true");
  await context.close();
});

test("a failed demo: trying again clears ?demo=failed from the address", async ({ page }) => {
  // Filtered: Next's route announcer is an alert too.
  const failed = page.getByRole("alert").filter({ hasText: "The demo didn't start. Try again in a moment." });
  await page.goto("/?demo=failed");
  await expect(failed).toHaveCount(1);
  // This retry fails too, before any sign-in reaches Supabase (no anonymous sign-in spent).
  await page.route("**/auth/v1/signup", (route) => route.abort());
  await page.getByRole("button", { name: "Try the demo" }).click();
  await expect(page).not.toHaveURL(/demo=failed/);
  await expect(failed).toHaveCount(1);
});

test("Try it on a stale landing tab keeps the real login", async ({ page, context }) => {
  const stale = await context.newPage();
  await stale.goto("/");
  await signUp(page, uniqueEmail());
  await completeOnboarding(page, { name: "Stale Tab" });

  await stale.getByRole("button", { name: "Try the demo" }).click();
  await expect(stale).toHaveURL(/\/today/);
  await expect(stale.getByRole("button", { name: "Check in: Read", exact: true })).toHaveCount(0);
  await stale.goto("/profile");
  await expect(stale.getByText("Stale Tab").first()).toBeVisible();
});

test("an invite link opened in the demo: Sign in leaves the demo and comes back to the invite", async ({ page, browser }) => {
  test.setTimeout(90_000);
  // A real inviter, and a real account to sign in with afterwards.
  const inviterContext = await browser.newContext();
  const inviter = await inviterContext.newPage();
  await signUp(inviter, uniqueEmail("inviter"));
  await completeOnboarding(inviter, { name: "Inviter" });
  await createGroup(inviter, "Real family");
  const url = await inviteLink(inviter);
  const token = new URL(url).pathname.split("/").pop()!;
  const joinerContext = await browser.newContext();
  const joiner = await joinerContext.newPage();
  const joinerEmail = uniqueEmail("joiner");
  await signUp(joiner, joinerEmail);
  await completeOnboarding(joiner, { name: "Joiner" });
  await joinerContext.close();

  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo" }).click();
  await expect(page).toHaveURL(/\/today/);
  await page.goto(new URL(url).pathname);
  await expect(page.getByText(BANNER)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Join / })).toHaveCount(0);

  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/login\\?next=%2Finvite%2F${token}$`));
  await page.getByLabel("Email").fill(joinerEmail);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/invite/${token}$`));
  await expect(page.getByRole("button", { name: /^Join / })).toBeVisible();
  await expect(page.getByText(BANNER)).toHaveCount(0);
  await inviterContext.close();
});
