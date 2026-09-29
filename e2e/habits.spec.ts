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
  await expect(page.getByLabel("Starts")).not.toHaveValue("");

  await page.getByRole("button", { name: "Add habit" }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByText("Drink water")).toBeVisible();
});

test("custom habits are validated", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/habits/new");

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

test("browsing tabs after picking a template doesn't change its category", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/habits/new");
  await page.getByRole("button", { name: /^Drink water/ }).click();
  await expect(page.getByLabel("Category")).toHaveValue("health");

  await page.getByRole("tab", { name: "Fitness" }).click();
  await expect(page.getByLabel("Category")).toHaveValue("health");
});

test("the ＋ button opens a new habit", async ({ page }) => {
  await signUpAndOnboard(page);
  await createHabit(page, { template: "Read 20 min" });
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "New habit" }).click();
  await expect(page).toHaveURL(/\/habits\/new$/);
});
