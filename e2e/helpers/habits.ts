import { execSync } from "node:child_process";
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

// Makes a habit look like it ran for three days and ended yesterday (ideas/habit-end-date.md), without
// waiting 30 days: the dates are moved in the local test database with triggers off for this one
// statement (habit_rules refuses a start in the past). Local stack only.
export function endHabitYesterday(habitId: string): void {
  if (!/^[0-9a-f-]{36}$/.test(habitId)) throw new Error(`Not a habit id: ${habitId}`);
  execSync(
    `docker exec -i supabase_db_keepup psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q`,
    {
      input: `set session_replication_role = replica;
update public.habits set starts_on = current_date - 3, ends_on = current_date - 1 where id = '${habitId}';`,
      stdio: ["pipe", "ignore", "inherit"],
    },
  );
}
