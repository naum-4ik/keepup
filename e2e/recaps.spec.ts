import { expect, test } from "@playwright/test";
import { signUp, completeOnboarding, uniqueEmail } from "./helpers/auth";
import { createHabit, seedPastCheckIns, startHabitDaysAgo } from "./helpers/habits";

test("Progress → Recaps: a new account waits for its first week", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await completeOnboarding(page);
  await page.goto("/progress");
  await page.getByRole("link", { name: "Recaps" }).click();
  await expect(page).toHaveURL(/\/progress\/recaps$/);
  await expect(page.getByText("Your first weekly recap arrives on the first day of next week.")).toBeVisible();
});

test("Progress → Recaps lists last week with its check-ins and longest streak", async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await completeOnboarding(page);
  await createHabit(page, { title: "Walk", count: 1, period: "day" });
  const id = (await page.getByRole("link", { name: /Walk/ }).first().getAttribute("href"))!.split("/").pop()!;
  startHabitDaysAgo(id, 20);
  seedPastCheckIns(id, email, [7, 8, 9, 10, 11, 12, 13, 14]);
  await page.goto("/progress/recaps");
  const weeks = page.getByRole("region", { name: "Weeks" });
  await expect(weeks.getByRole("listitem").first()).toContainText(/check-ins? last week/);
});
