import { expect, test } from "@playwright/test";
import { signUpAndOnboard } from "./helpers/auth";
import { createHabit } from "./helpers/habits";

// The one end-to-end test every PR runs (decision 0024): the core path through a real database.
// Sign up, onboard, add a habit, check in, and the check-in is still there after a reload.
test("sanity: sign up, add a habit, check in, and it's saved", async ({ page }) => {
  await signUpAndOnboard(page);
  await createHabit(page, { template: "Drink water" });
  await expect(page.getByText("0 / 8 today")).toBeVisible();
  await page.getByRole("button", { name: "Check in: Drink water" }).click();
  await expect(page.getByText("1 / 8 today")).toBeVisible();
  await page.reload();
  await expect(page.getByText("1 / 8 today")).toBeVisible();
});
