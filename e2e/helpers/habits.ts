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
    await page.getByLabel("Category").selectOption("health");
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

// Moves a habit's start back (Progress → Calendar needs past months). Same trick as above.
export function startHabitDaysAgo(habitId: string, days: number): void {
  if (!/^[0-9a-f-]{36}$/.test(habitId) || !Number.isInteger(days)) throw new Error(`Bad input: ${habitId} ${days}`);
  execSync(
    `docker exec -i supabase_db_keepup psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q`,
    {
      input: `set session_replication_role = replica;
update public.habits set starts_on = current_date - ${days} where id = '${habitId}';`,
      stdio: ["pipe", "ignore", "inherit"],
    },
  );
}

// Check-ins on past days (Progress → Recaps needs a finished week), written straight into the local test
// database with triggers off for this one statement. Local stack only.
export function seedPastCheckIns(habitId: string, userEmail: string, daysAgo: number[]): void {
  if (!/^[0-9a-f-]{36}$/.test(habitId) || !/^[a-z0-9.+-]+@example\.com$/.test(userEmail) || !daysAgo.every(Number.isInteger)) {
    throw new Error("Bad input");
  }
  execSync(`docker exec -i supabase_db_keepup psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q`, {
    input: `set session_replication_role = replica;
insert into public.check_ins (habit_id, user_id, local_date, period_start, status, created_at, logged_by)
select '${habitId}', u.id, current_date - d, current_date - d, 'approved', now() - make_interval(days => d), u.id
  from (select id from auth.users where email = '${userEmail}') u, unnest(array[${daysAgo.join(",")}]::int[]) d;
update public.profiles set created_at = now() - interval '30 days' where id = (select id from auth.users where email = '${userEmail}');`,
    stdio: ["pipe", "ignore", "inherit"],
  });
}

// How many check-ins a habit has, read from the local test database. Local stack only.
export function countCheckIns(habitId: string): number {
  return countWhere("habit_id", habitId);
}

// How many check-ins a person (a child, say) has. Local stack only.
export function countCheckInsOf(userId: string): number {
  return countWhere("user_id", userId);
}

function countWhere(column: "habit_id" | "user_id", id: string): number {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error(`Not an id: ${id}`);
  const out = execSync(`docker exec -i supabase_db_keepup psql -U postgres -d postgres -tA -v ON_ERROR_STOP=1`, {
    input: `select count(*) from public.check_ins where ${column} = '${id}';`,
    encoding: "utf8",
  });
  return Number(out.trim());
}
