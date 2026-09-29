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

test.describe("Today check-ins", () => {
  test("checking in on a several-times-a-day habit counts up", async ({ page }) => {
    await signUpAndOnboard(page);
    await createHabit(page, { template: "Drink water" });
    await expect(page.getByText("0 / 8 today")).toBeVisible();
    await page.getByRole("button", { name: "Check in: Drink water" }).click();
    await expect(page.getByText("1 / 8 today")).toBeVisible();
  });

  test("a weekly habit allows one check-in per day", async ({ page }) => {
    await signUpAndOnboard(page);
    await createHabit(page, { template: "Work out" });
    await page.getByRole("button", { name: "Check in: Work out" }).click();
    await expect(page.getByRole("button", { name: "Checked in today: Work out" })).toBeDisabled();
    await expect(page.getByText(/1 of 3 this week/)).toBeVisible();
  });

  test("a double tap checks in only once", async ({ page }) => {
    await signUpAndOnboard(page);
    await createHabit(page, { template: "Read 20 min" });
    const habitRow = page.getByRole("listitem").filter({ hasText: "Read 20 min" });
    await habitRow.getByRole("button", { name: "Check in: Read 20 min" }).dblclick();
    const button = habitRow.getByRole("button", { name: "Done: Read 20 min" });
    await expect(button).toBeVisible();
    await expect(button).toBeDisabled();
    // Wait for the request to fully settle (not just dimmed while pending) before checking for an
    // error, so a second, rejected check-in wouldn't slip past the assertion below.
    await expect(button).not.toHaveClass(/opacity-60/);
    // Scoped to the habit row: the App Router's route announcer also has role="alert" on the page.
    await expect(habitRow.getByRole("alert")).toHaveCount(0);
    await expect(page.getByText("Done for today")).toBeVisible();
  });

  test("habits left to do come first, then done, then ones that start later", async ({ page }) => {
    await signUpAndOnboard(page);
    await page.goto("/habits/new");
    await page.getByRole("button", { name: /^Read 20 min/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Tomorrow" }).click();
    await page.getByRole("dialog").getByRole("button", { name: /^Add habit/ }).click();
    await expect(page).toHaveURL(/\/today$/);
    await createHabit(page, { template: "Meditate" });
    await createHabit(page, { template: "Walk 10,000 steps" });

    await page.getByRole("button", { name: "Check in: Meditate" }).click();
    await expect(page.getByRole("button", { name: "Done: Meditate" })).toBeVisible();

    const rows = await page.locator('li:has(a[href^="/habits/"]:not([href="/habits/new"]))').allInnerTexts();
    expect(rows).toHaveLength(3);
    ["Walk 10,000 steps", "Meditate", "Read 20 min"].forEach((title, i) => expect(rows[i]).toContain(title));
    await expect(page.getByRole("region", { name: "Later" })).toContainText("Read 20 min");
  });
});

test.describe("Habit detail", () => {
  test("the habit page shows this period's check-ins and can undo them", async ({ page }) => {
    await signUpAndOnboard(page);
    await createHabit(page, { template: "Read 20 min" });
    await page.getByRole("button", { name: "Check in: Read 20 min" }).click();
    await expect(page.getByRole("button", { name: "Done: Read 20 min" })).toBeVisible();

    await page.getByRole("link", { name: /Read 20 min/ }).click();
    await expect(page.getByText("1 check-in this period")).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("No check-ins this period yet.")).toBeVisible();

    await page.goto("/today");
    await expect(page.getByText("Not done yet")).toBeVisible();
  });

  test("a habit can be paused from today and resumed", async ({ page }) => {
    await signUpAndOnboard(page);
    await createHabit(page, { template: "Meditate" });
    await page.getByRole("link", { name: /Meditate/ }).click();

    await page.getByRole("button", { name: "Pause habit" }).click();
    await expect(page.getByText(/^Paused from /)).toBeVisible();
    await page.goto("/today");
    await expect(page.getByRole("button", { name: "Paused: Meditate" })).toBeDisabled();
    await page.getByRole("link", { name: /Meditate/ }).click();
    await page.getByRole("button", { name: "Resume" }).click();
    await expect(page.getByRole("button", { name: "Pause habit" })).toBeVisible();
  });

  test("a habit without check-ins can be deleted; one with history is archived", async ({ page }) => {
    await signUpAndOnboard(page);
    await createHabit(page, { template: "Tidy up", tab: "Home" });
    await page.getByRole("link", { name: /Tidy up/ }).click();
    await page.getByRole("button", { name: "Delete habit" }).click();
    const confirmDialog = page.getByRole("dialog");
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByText("Tidy up")).toHaveCount(0);

    await createHabit(page, { template: "Make the bed", tab: "Home" });
    await page.getByRole("button", { name: "Check in: Make the bed" }).click();
    await expect(page.getByRole("button", { name: "Done: Make the bed" })).toBeVisible();
    await page.getByRole("link", { name: /Make the bed/ }).click();
    await expect(page.getByRole("button", { name: "Delete habit" })).toHaveCount(0);
    await page.getByRole("button", { name: "Archive habit" }).click();
    await expect(page).toHaveURL(/\/progress\?view=archived$/);

    await page.goto("/today");
    await expect(page.getByText("Make the bed")).toHaveCount(0);
  });

  test("a habit's title can be edited", async ({ page }) => {
    await signUpAndOnboard(page);
    await createHabit(page, { template: "Work out" });
    await page.getByRole("link", { name: /Work out/ }).click();
    await page.getByLabel("Title").fill("Work out at home");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status")).toHaveText("Saved.");
    await expect(page.getByRole("heading", { name: "Work out at home" })).toBeVisible();
  });
});
