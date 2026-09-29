import { expect, test } from "@playwright/test";
import { signUpAndOnboard } from "./helpers/auth";
import { createHabit } from "./helpers/habits";

test("a new user adds a habit from a template", async ({ page }) => {
  await signUpAndOnboard(page);
  await expect(page.getByText("Nothing to do yet")).toBeVisible();
  await page.getByRole("link", { name: "Add your first habit" }).click();
  await expect(page).toHaveURL(/\/habits\/new$/);

  await page.getByRole("button", { name: /^Drink water/ }).click();
  await expect(page.getByLabel("Title")).toHaveValue("Drink water");
  await expect(page.getByLabel("Times")).toHaveValue("8");
  await expect(page.getByLabel("Per")).toHaveValue("day");
  await expect(page.getByRole("button", { name: "Today", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Add habit" }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByText("Drink water")).toBeVisible();
});

test("custom habits are validated", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/habits/new");
  await page.getByRole("button", { name: "Create your own" }).click();

  await page.getByLabel("Title").fill("   ");
  await page.getByRole("button", { name: "Add habit" }).click();
  await expect(page.getByText("Enter a title.")).toBeVisible();

  await page.getByLabel("Title").fill("Stretch");
  await page.getByLabel("Times").fill("8");
  await page.getByLabel("Per").selectOption("week");
  await page.getByRole("button", { name: "Add habit" }).click();
  await expect(page.getByText("Pick 1–7 times a week.")).toBeVisible();
  await expect(page.getByLabel("Per")).toHaveValue("week");

  await page.getByLabel("Times").fill("2");
  await page.getByRole("button", { name: "Add habit" }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByText("Stretch")).toBeVisible();
});

test("category tabs show more templates and 'Create your own'", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/habits/new");
  await expect(page.getByRole("button", { name: /^Floss/ })).toHaveCount(0);
  await page.getByRole("tab", { name: "Health" }).click();
  await expect(page.getByRole("button", { name: /^Floss/ })).toBeVisible();
  await page.getByRole("tab", { name: "Money" }).click();
  await page.getByRole("button", { name: "Create your own" }).click();
  await expect(page.getByLabel("Category")).toHaveValue("money");
  await expect(page.getByLabel("Title")).toBeFocused();
});

test("a template opens in a sheet that can be closed without adding", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/habits/new");
  await page.getByRole("button", { name: /^Drink water/ }).click();
  const sheet = page.getByRole("dialog", { name: "Add habit" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel("Category")).toHaveValue("health");

  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();
  await page.goto("/today");
  await expect(page.getByText("Nothing to do yet")).toBeVisible();
});

test("the ＋ button opens a new habit", async ({ page }) => {
  await signUpAndOnboard(page);
  await createHabit(page, { template: "Read 20 min" });
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "New habit" }).click();
  await expect(page).toHaveURL(/\/habits\/new$/);
});

test("every template tab fits above the bottom nav on a small phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await signUpAndOnboard(page);
  await page.goto("/habits/new");
  const nav = await page.getByRole("navigation", { name: "Main" }).boundingBox();
  for (const name of ["Popular", "Health", "Fitness", "Mind", "Learning", "People", "Home", "Money", "Break a habit"]) {
    await page.getByRole("tab", { name }).click();
    const last = await page.getByRole("button", { name: "Create your own" }).boundingBox();
    expect(last!.y + last!.height, name).toBeLessThanOrEqual(nav!.y);
  }
});

test("the start date can be picked from quick choices or the calendar", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/habits/new");
  await page.getByRole("button", { name: /^Read 20 min/ }).click();
  const dialog = page.getByRole("dialog", { name: "Add habit" });

  await dialog.getByRole("button", { name: "Tomorrow" }).click();
  await expect(dialog.getByRole("button", { name: "Tomorrow" })).toHaveAttribute("aria-pressed", "true");

  await dialog.getByRole("button", { name: "Pick a date" }).click();
  await dialog.getByRole("button", { name: "Next month" }).click();
  await dialog.getByRole("button", { name: /^\w{3} 15 / }).click();
  const picked = dialog.getByRole("button", { name: /^Pick a date, \w{3} 15 / });
  await expect(picked).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByRole("button", { name: "Next month" })).toBeHidden();

  await dialog.getByRole("button", { name: /^Add habit/ }).click();
  await expect(page).toHaveURL(/\/today$/);
});
