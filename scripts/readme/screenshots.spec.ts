import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { completeOnboarding, signUp, uniqueEmail } from "../../e2e/helpers/auth";
import { createGroup } from "../../e2e/helpers/groups";
import { createHabit } from "../../e2e/helpers/habits";

// README screenshots (docs/screenshots). Local stack only: seeds a month of history straight into the
// database (triggers off), like e2e/helpers do. Run: npm run readme:screenshots
const OUT = "docs/screenshots";

function seedHistory(email: string): void {
  if (!/^[\w.+-]+@[\w.-]+$/.test(email)) throw new Error(`Not an email: ${email}`);
  const sql = `
set session_replication_role = replica;
create temp table u as select id from auth.users where email = '${email}';
update public.habits set starts_on = current_date - 34 where owner_id = (select id from u);
-- Daily habits: most days done, and the last 12 days all done, so there are streaks.
-- Weekly "Work out": Monday, Wednesday, Friday.
insert into public.check_ins (habit_id, user_id, local_date, period_start, logged_by)
select h.id, h.owner_id, d::date, private.habit_period_start(h, d::date), h.owner_id
  from public.habits h
  cross join generate_series(current_date - 34, current_date - 1, interval '1 day') d
  cross join lateral generate_series(1, case when h.period = 'day' then h.target_count else 1 end) n
 where h.owner_id = (select id from u)
   and case when h.period = 'day' then abs(hashtext(h.id::text || d::text)) % 5 <> 0 or d > current_date - 12
            else extract(isodow from d) in (1, 3, 5) end;
insert into public.period_results (habit_id, period_start, outcome, finalized_at)
select h.id, s.d::date, private.period_outcome(h, s.d::date), now()
  from public.habits h
  cross join lateral generate_series(
    private.first_period_start(h)::timestamp,
    private.habit_period_start(h, private.habit_today(h, now()))::timestamp - private.period_step(h.period),
    private.period_step(h.period)) s(d)
 where h.owner_id = (select id from u)
on conflict (habit_id, period_start) do nothing;`;
  execSync("docker exec -i supabase_db_keepup psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q", {
    input: sql,
    stdio: ["pipe", "ignore", "inherit"],
  });
}

test("README screenshots", async ({ page }) => {
  test.setTimeout(120_000);
  const email = uniqueEmail("readme");
  await signUp(page, email);
  await completeOnboarding(page, { name: "Ana" });
  for (const template of ["Drink water", "Walk 10,000 steps", "Meditate", "Read 20 min", "Work out"]) {
    await createHabit(page, { template });
  }
  seedHistory(email);

  await createGroup(page, "The Rossis");
  await page.goto("/groups");
  await page.getByRole("link", { name: /The Rossis/ }).click();
  await page.getByRole("link", { name: "Add a child" }).click();
  await page.getByLabel("Nickname").fill("Mary");
  await page.getByRole("group", { name: "Avatar" }).getByRole("button", { name: "🐼" }).click();
  await page.getByLabel("I'm this child's parent or guardian").check();
  await page.getByRole("button", { name: "Add Mary" }).click();
  await expect(page).toHaveURL(/\/kids\/[0-9a-f-]{36}$/);
  const kidPage = page.url();

  // Today, half done.
  await page.goto("/today");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Check in: Drink water" }).click();
  await page.getByRole("button", { name: "Check in: Walk 10,000 steps" }).click();
  await expect(page.getByRole("button", { name: "Done: Walk 10,000 steps" })).toBeVisible();
  await page.getByRole("button", { name: "Check in: Meditate" }).click();
  await expect(page.getByRole("button", { name: "Done: Meditate" })).toBeVisible();
  await page.getByRole("button", { name: /^Check in for Mary: / }).first().click();
  await page.goto("/today");
  await page.screenshot({ path: `${OUT}/today.png` });

  await page.goto("/progress");
  await page.screenshot({ path: `${OUT}/progress.png` });

  await page.goto("/progress/calendar");
  await page.getByRole("button", { name: /: \d+ of \d+ done$/ }).last().click();
  await page.screenshot({ path: `${OUT}/calendar.png` });

  await page.getByRole("link", { name: "Back to Progress" }).click();
  await page.getByRole("link", { name: /Meditate/ }).click();
  await expect(page).toHaveURL(/\/habits\/[0-9a-f-]{36}$/);
  await page.screenshot({ path: `${OUT}/habit.png` });

  await page.goto("/habits/new");
  await page.screenshot({ path: `${OUT}/new-habit.png` });

  await page.goto(kidPage);
  await page.getByRole("link", { name: "Open Mary's view" }).click();
  for (const b of await page.getByRole("button", { name: /Brush teeth|Tidy my toys|Get dressed/ }).all()) await b.click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800); // let the scene settle
  await page.screenshot({ path: `${OUT}/kid-view.png` });
});
