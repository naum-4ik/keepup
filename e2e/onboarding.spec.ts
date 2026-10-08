import { expect, test, type Page } from "@playwright/test";
import { signUp, uniqueEmail } from "./helpers/auth";

async function finishStepOne(page: Page, purpose?: "Me" | "My family" | "Friends") {
  await expect(page).toHaveURL(/\/onboarding$/);
  if (purpose) {
    const chip = page.getByRole("button", { name: purpose, exact: true });
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
  }
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/onboarding\/habits$/);
}

const card = (page: Page, title: string) => page.getByRole("button", { name: new RegExp(`^${title}`) });

test("step 1 pre-fills the name, shows the detected line, and has no reminder hour", async ({ page }) => {
  await signUp(page, uniqueEmail("ana.lee"));
  await expect(page).toHaveURL(/\/onboarding$/);

  await expect(page.getByLabel("Display name")).toHaveValue(/^Ana Lee-/);
  await expect(page.getByText("weeks start Sunday")).toBeVisible(); // en-US locale in the test browser
  await expect(page.getByLabel("Time zone")).toBeHidden();
  await expect(page.getByLabel("Daily reminder")).toHaveCount(0);
  await expect(page.getByText("By continuing, you agree to the Privacy Policy")).toBeVisible();

  await page.getByRole("button", { name: "Change" }).click();
  await expect(page.getByLabel("Time zone")).toHaveValue("Europe/Rome");
  await expect(page.getByLabel("Week starts on")).toHaveValue("0");

  await finishStepOne(page);
  await page.getByRole("link", { name: "Skip for now" }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByText("Nothing to do yet")).toBeVisible();

  await page.goto("/profile/settings");
  await expect(page.getByLabel("Daily reminder")).toBeVisible(); // back with reminders (M4)
});

test("purpose My family adds People and Home templates to step 2", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await finishStepOne(page, "My family");
  await expect(card(page, "Drink water")).toBeVisible();
  await expect(card(page, "Call family or a friend")).toBeVisible();
  await expect(card(page, "Make the bed")).toBeVisible();
  await expect(card(page, "No sugar")).toHaveCount(0);
});

test("without a purpose step 2 shows only the Popular templates", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await finishStepOne(page);
  await expect(page.locator("button[aria-pressed]")).toHaveCount(6);
  await expect(card(page, "Call family or a friend")).toHaveCount(0);
});

test("picking 2 habits lands on Today with both, and a check-in clears the tip", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await finishStepOne(page);

  await expect(page.getByRole("button", { name: "Pick a habit to start" })).toBeDisabled();
  await card(page, "Meditate").click();
  await expect(card(page, "Meditate")).toHaveAttribute("aria-pressed", "true");
  await card(page, "Read 20 min").click();
  await card(page, "Work out").click();
  await card(page, "Drink water").click();
  await expect(page.getByText("Pick up to 3")).toBeVisible();
  await expect(card(page, "Drink water")).toHaveAttribute("aria-pressed", "false");
  await card(page, "Work out").click(); // un-pick: back to 2
  await expect(page.getByText("Pick up to 3")).toHaveCount(0);

  await page.getByRole("button", { name: "Start with 2 habits" }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole("button", { name: "Check in: Meditate" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Check in: Read 20 min" })).toBeVisible();
  await expect(page.getByText("Work out")).toHaveCount(0);

  await expect(page.getByText("Tap when you've done it")).toBeVisible();
  await page.getByRole("button", { name: "Check in: Meditate" }).click();
  await expect(page.getByRole("button", { name: "Done: Meditate" })).toBeVisible();
  await expect(page.getByText("Tap when you've done it")).toHaveCount(0);

  // Step 2 is only for starting out.
  await page.goto("/onboarding/habits");
  await expect(page).toHaveURL(/\/today$/);
});

test("the first check-in tip shows once and not after a reload", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await finishStepOne(page);
  await card(page, "Walk 10,000 steps").click();
  await page.getByRole("button", { name: "Start with 1 habit" }).click();
  await expect(page).toHaveURL(/\/today$/);

  const tip = page.getByRole("button", { name: "Dismiss tip: Tap when you've done it" });
  await expect(tip).toBeVisible();
  await tip.click();
  await expect(tip).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("button", { name: "Check in: Walk 10,000 steps" })).toBeVisible();
  await expect(page.getByText("Tap when you've done it")).toHaveCount(0);
});

test("step 2 needs a finished step 1", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.goto("/onboarding/habits");
  await expect(page).toHaveURL(/\/onboarding$/);
});
