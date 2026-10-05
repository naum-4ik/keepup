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

test("five counted check-ins reach level 2: on the avatar and on Profile", async ({ page }) => {
  await signUpAndOnboard(page);
  for (const title of ["Walk", "Read", "Stretch", "Water", "Tidy"]) await createHabit(page, { title, count: 1, period: "day" });
  for (const title of ["Walk", "Read", "Stretch", "Water", "Tidy"]) {
    await page.getByRole("button", { name: `Check in: ${title}` }).click();
    await expect(page.getByRole("button", { name: `Done: ${title}` })).toBeVisible();
  }
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Level 2 · Seedling" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "XP to Level 3" })).toHaveAttribute("aria-valuenow", "0");
  await expect(page.getByText("150 XP to Level 3")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" }).getByText("2", { exact: true })).toBeVisible();
});
