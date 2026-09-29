import { expect, test } from "@playwright/test";
import { signUpAndOnboard } from "./helpers/auth";
import { createHabit } from "./helpers/habits";

test("the weekly overview shows on Today and Progress", async ({ page }) => {
  await signUpAndOnboard(page);
  await expect(page.getByRole("link", { name: /^This week/ })).toHaveCount(0);

  await createHabit(page, { title: "Walk", count: 1, period: "day" });
  await createHabit(page, { title: "Read", count: 1, period: "day" });
  await page.getByRole("button", { name: "Check in: Walk" }).click();
  await expect(page.getByRole("button", { name: "Done: Walk" })).toBeVisible();

  // Only finished periods count this week: Read is still open today, so it's 1 of 1.
  const strip = page.getByRole("link", { name: /^This week/ });
  await expect(strip).toContainText("1 of 1");
  await expect(strip.getByRole("img", { name: "1 of 1 done this week" })).toBeVisible();
  await strip.click();
  await expect(page).toHaveURL(/\/progress$/);

  const card = page.getByRole("region", { name: "Your week" });
  await expect(card).toContainText("1 of 1 done");
  await expect(card).toContainText("1 more than last week");
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "Europe/Rome" }).format(new Date());
  // Today's circle fills against both of today's daily habits.
  await expect(card.getByRole("img", { name: `${weekday}: 1 of 2 done` })).toBeVisible();
  await expect(card.getByRole("listitem").filter({ hasText: "check-in" })).toHaveText("1check-in");
  await expect(card.getByRole("listitem").filter({ hasText: "active habits" })).toHaveText("2active habits");

  await expect(page.getByRole("link", { name: /Walk/ }).getByRole("img", { name: "Last 7 days: 6 not started, 1 done" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Read/ }).getByRole("img", { name: "Last 7 days: 6 not started, 1 in progress" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("%");
});
