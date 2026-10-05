import { expect, test } from "@playwright/test";
import { signUpAndOnboard } from "./helpers/auth";
import { createHabit } from "./helpers/habits";

test("a counted check-in floats +10 XP", async ({ page }) => {
  await signUpAndOnboard(page);
  await createHabit(page, { title: "Walk", count: 1, period: "day" });
  await page.getByRole("button", { name: "Check in: Walk" }).click();
  await expect(page.getByText("+10 XP")).toBeVisible();
});

test("a tap waiting on the phone floats +10 XP at once, and not again when it syncs", async ({ page, context }) => {
  await signUpAndOnboard(page);
  await createHabit(page, { title: "Walk", count: 1, period: "day" });
  await context.setOffline(true);
  await page.getByRole("button", { name: "Check in: Walk" }).click();
  await expect(page.getByText("+10 XP")).toBeVisible();
  await expect(page.getByText("+10 XP")).toHaveCount(0);
  await context.setOffline(false);
  await expect(page.getByRole("button", { name: "Done: Walk" })).toBeVisible();
  await expect(page.getByText("+10 XP")).toHaveCount(0);
});
