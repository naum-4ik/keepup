import { expect, test } from "./fixtures";
import { completeOnboarding, signUp, TEST_PASSWORD, uniqueEmail } from "./helpers/auth";
import { createGroup, inviteLink } from "./helpers/groups";

// The full banner outside the app (invite, onboarding); the one-line note in the app header.
const BANNER = "You're in the demo. Data resets after 24 hours.";
const NOTE = "Demo, resets in 24 h.";
const OFF = "That's off in the demo.";
const TRY = "Try a demo with sample habits";

// One Try it per test: each spends one of the local anonymous sign-ins (30 an hour per IP).
test("Try it: a full account in under 5 seconds, with a check-in to approve", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("By continuing, you agree to the Terms of use and the Privacy Policy")).toBeVisible();
  const started = Date.now();
  // The anonymous sign-in runs in the browser (each visitor's own IP against Supabase's per-IP limit).
  const signIn = page.waitForRequest((r) => r.method() === "POST" && r.url().includes("/auth/v1/signup"));
  await page.getByRole("button", { name: TRY }).click();
  await signIn;
  await expect(page.getByRole("button", { name: "Check in: \u2068Read 20 min\u2069", exact: true })).toBeVisible({ timeout: 5000 });
  expect(Date.now() - started).toBeLessThan(5000);
  await expect(page).toHaveURL(/\/today/);

  await page.goto("/inbox");
  // exact: "Approve" is also a substring of "Not approved".
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("All caught up: 0 check-ins waiting for your approval.")).toBeVisible();

  // The note on every app screen; what the demo can't do says so instead.
  await page.goto("/today");
  await expect(page.getByText(NOTE)).toBeVisible();
  await page.goto("/profile");
  await expect(page.getByText(NOTE)).toBeVisible();
  // The policy opens in the demo too (the consent line under the demo button points at it).
  await page.getByRole("link", { name: "Privacy Policy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { name: "Privacy Policy", level: 1 })).toBeVisible();

  await page.goto("/groups");
  await page.getByRole("link", { name: /Family/ }).first().click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}/);
  await expect(page.getByText(NOTE)).toBeVisible();
  await expect(page.getByText(OFF)).toBeVisible();
  await expect(page.getByRole("button", { name: /invite link/i })).toHaveCount(0);

  await page.getByRole("link", { name: /Nova/ }).first().click();
  await page.getByRole("link", { name: "Open \u2068Nova\u2069's view" }).click();
  await expect(page).toHaveURL(/\/kids\/[0-9a-f-]{36}\/play$/);
  // No demo note in the kid view: a child holds the phone.
  await expect(page.getByRole("heading", { name: "Nova", level: 1 })).toBeVisible();
  await expect(page.getByText(NOTE)).toHaveCount(0);

  await page.goto("/profile/settings");
  await expect(page.getByRole("region", { name: "Notifications" }).getByText(OFF)).toBeVisible();
  await expect(page.getByRole("button", { name: "Turn on reminders" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete account" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Export my data" })).toBeVisible();

  // The note's Sign in leaves the demo: the session is gone.
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/today");
  await expect(page).toHaveURL(/\/login/);
});

test("the demo button waits until the page is ready", async ({ browser }) => {
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
  await page.getByRole("button", { name: TRY }).click();
  await expect(page).not.toHaveURL(/demo=failed/);
  await expect(failed).toHaveCount(1);
});

test.describe("the demo's script fails to load", () => {
  // The app's service worker fetches /_next/static itself, and page.route never sees what it fetches
  // (the CI trace: the Supabase chunks loaded 200 and a real anonymous sign-in ran). Without it, every
  // chunk request reaches the route.
  test.use({ serviceWorkers: "block" });

  test("the next step is a reload, and after it the demo button works", async ({ page }) => {
    const reload = page.getByRole("alert").filter({ hasText: "Couldn't load the demo. Reload the page and try again." });
    // networkidle: the page's own scripts and link prefetches are done before the route goes in.
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: TRY })).toBeEnabled();
    // From here, every script request is the demo's (the Supabase client, on hover or tap): abort them all.
    const aborted: string[] = [];
    await page.route("**/_next/static/**/*.js", (route) => {
      aborted.push(route.request().url());
      return route.abort();
    });
    await page.getByRole("button", { name: TRY }).click();
    await expect.poll(() => aborted.length).toBeGreaterThan(0);
    await expect(reload).toHaveCount(1);
    // No anonymous sign-in was spent: the client never loaded.
    await page.unroute("**/_next/static/**/*.js");
    await page.getByRole("button", { name: "Reload", exact: true }).click();
    await expect(reload).toHaveCount(0);
    await expect(page.getByRole("button", { name: TRY })).toBeEnabled();
  });
});

test("Try it on a stale landing tab keeps the real login", async ({ page, context }) => {
  const stale = await context.newPage();
  await stale.goto("/");
  await signUp(page, uniqueEmail());
  await completeOnboarding(page, { name: "Stale Tab" });

  await stale.getByRole("button", { name: TRY }).click();
  await expect(stale).toHaveURL(/\/today/);
  await expect(stale.getByRole("button", { name: "Check in: \u2068Read 20 min\u2069", exact: true })).toHaveCount(0);
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
  await page.getByRole("button", { name: TRY }).click();
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
