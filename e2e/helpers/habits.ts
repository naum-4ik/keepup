import { expect, type Page } from "@playwright/test";

type NewHabit = { template: string; tab?: string } | { title: string; count: number; period: "day" | "week" | "month" };

export async function createHabit(page: Page, habit: NewHabit): Promise<void> {
  await page.goto("/habits/new");
  if ("template" in habit) {
    if (habit.tab) await page.getByRole("tab", { name: habit.tab }).click();
    await page.getByRole("button", { name: new RegExp(`^${habit.template.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }).click();
  } else {
    await page.getByRole("button", { name: "Create your own" }).click();
    await page.getByLabel("Title").fill(habit.title);
    await page.getByLabel("Times").fill(String(habit.count));
    await page.getByLabel("Per").selectOption(habit.period);
  }
  await page.getByRole("button", { name: "Add habit" }).click();
  await expect(page).toHaveURL(/\/today$/);
}
