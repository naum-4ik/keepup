import { expect, test } from "@playwright/test";
import { signUpAndOnboard } from "./helpers/auth";
import { createHabit, startHabitDaysAgo } from "./helpers/habits";

test("the weekly overview shows on Today and Progress", async ({ page }) => {
  await signUpAndOnboard(page);
  await expect(page.getByRole("link", { name: /^This week/ })).toHaveCount(0);

  await createHabit(page, { title: "Walk", count: 1, period: "day" });
  await createHabit(page, { title: "Read", count: 1, period: "day" });
  const strip = page.getByRole("link", { name: /^This week/ });
  // Day one: today's daily habits count as possible right away, so the strip shows 0 of 2.
  await expect(strip).toContainText("0 of 2");

  await page.getByRole("button", { name: "Check in: Walk" }).click();
  await expect(page.getByRole("button", { name: "Done: Walk" })).toBeVisible();
  await expect(strip).toContainText("1 of 2");
  await expect(strip.getByRole("img", { name: "1 of 2 goals met this week" })).not.toHaveAttribute("data-complete", "");

  await page.getByRole("button", { name: "Check in: Read" }).click();
  await expect(page.getByRole("button", { name: "Done: Read" })).toBeVisible();
  // All done so far: the ring is replaced by the filled check.
  await expect(strip.getByRole("img", { name: "2 of 2 goals met this week" })).toHaveAttribute("data-complete", "");
  await expect(strip.locator("[data-complete] svg.lucide-check")).toBeVisible();
  await strip.click();
  await expect(page).toHaveURL(/\/progress$/);

  const card = page.getByRole("region", { name: "Your week" });
  await expect(card).toContainText("2 of 2 goals met");
  // No last week to compare with yet, so no second line restating the headline.
  await expect(card).not.toContainText("this week");
  await expect(card.getByRole("img", { name: "2 of 2 goals met this week" })).toHaveAttribute("data-complete", "");
  // Today's circle fills against both of today's daily habits (the weekday comes from the server's
  // clock in the user's time zone, so it isn't recomputed here).
  const todayButton = card.getByRole("button", { name: /^\w+day: 2 of 2 done$/ });
  await expect(todayButton).toBeVisible();
  // Tap a day: what you did that day.
  await expect(card.getByText("Tap a day to see what you did.")).toBeVisible();
  await todayButton.click();
  const day = card.getByRole("region", { name: /\d/ }); // named by its date
  await expect(day).toContainText("Today");
  await expect(day).toContainText("2 of 2 daily done");
  await expect(day.getByRole("listitem").filter({ hasText: "Walk" })).toContainText("Done");
  await expect(day.getByRole("listitem").filter({ hasText: "Read" })).toContainText("Done");
  await todayButton.click();
  await expect(day).toBeHidden();
  await expect(card.getByRole("listitem").filter({ hasText: "check-in" })).toHaveText("2check-ins");
  await expect(card.getByRole("listitem").filter({ hasText: "active habits" })).toHaveText("2active habits");

  await expect(page.getByRole("link", { name: /Walk/ }).getByRole("img", { name: "Last 7 days: 6 not started, 1 done" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Read/ }).getByRole("img", { name: "Last 7 days: 6 not started, 1 done" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("%");
});

test("Progress → Calendar: the month, earlier months, and tap a day", async ({ page }) => {
  await signUpAndOnboard(page);
  await createHabit(page, { title: "Walk", count: 1, period: "day" });
  const id = (await page.getByRole("link", { name: /Walk/ }).getAttribute("href"))!.split("/").pop()!;
  startHabitDaysAgo(id, 40);
  await page.getByRole("button", { name: "Check in: Walk" }).click();
  await expect(page.getByRole("button", { name: "Done: Walk" })).toBeVisible();

  await page.goto("/progress");
  await page.getByRole("region", { name: "Your week" }).getByRole("link", { name: "Calendar" }).click();
  await expect(page).toHaveURL(/\/progress\/calendar$/);
  const month = page.getByRole("navigation", { name: "Month" });
  // The current month: no way forward, a way back (the habit started 40 days ago).
  await expect(month.getByRole("link", { name: /^Next month/ })).toHaveCount(0);
  const current = await month.getByRole("heading").textContent();

  const today = page.getByRole("button", { name: /: 1 of 1 done$/ });
  await expect(today).toHaveCount(1);
  await today.click();
  const panel = page.getByRole("region", { name: /\d/ });
  await expect(panel).toContainText("Today");
  await expect(panel.getByRole("listitem").filter({ hasText: "Walk" })).toContainText("Done");

  await month.getByRole("link", { name: /^Previous month/ }).click();
  await expect(page).toHaveURL(/\?m=\d{4}-\d{2}$/);
  await expect(month.getByRole("heading")).not.toHaveText(current!);
  await expect(month.getByRole("link", { name: /^Next month/ })).toBeVisible();
  // A past day with nothing checked in.
  const past = page.getByRole("button", { name: /: 0 of 1 done$/ }).last();
  await past.click();
  await expect(panel.getByRole("listitem").filter({ hasText: "Walk" })).toContainText("Not done");
  // Never before the first habit, never after this month.
  await page.goto("/progress/calendar?m=2099-01");
  await expect(month.getByRole("heading")).toHaveText(current!);
});

test("Progress: a chip per category jumps to its section", async ({ page }) => {
  await signUpAndOnboard(page);
  await createHabit(page, { template: "Drink water" });
  await createHabit(page, { template: "Work out" });
  await page.goto("/progress");
  const chips = page.getByRole("navigation", { name: "Categories" });
  await expect(chips.getByRole("link")).toHaveText(["Health", "Fitness"]);
  await chips.getByRole("link", { name: "Fitness" }).click();
  await expect(page).toHaveURL(/#cat-fitness$/);
  await expect(page.getByRole("region", { name: "Fitness" })).toBeInViewport();
});

test("a new user's empty lists say what's next, in one card style", async ({ page }) => {
  await signUpAndOnboard(page);
  await expect(page.getByText("Nothing to do yet. Add a habit to get started.")).toBeVisible();
  await page.goto("/progress");
  await expect(page.getByText("No habits yet.")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Categories" })).toHaveCount(0);
  await page.goto("/groups");
  await expect(page.getByText("Share habits with the people you live and hang out with.")).toBeVisible();
  await page.goto("/inbox");
  await expect(page.getByText("Nothing yet. Activity from your groups shows up here.")).toBeVisible();
});
