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

test("README screenshots", async ({ page, context }) => {
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
  for (const title of ["Make my bed", "Eat a fruit"]) {
    await page.getByRole("button", { name: "Add a habit" }).click();
    const dialog = page.getByRole("dialog", { name: "Add a habit for Mary" });
    await dialog.getByRole("button", { name: `Add ${title}` }).click();
    await expect(dialog.getByRole("status")).toHaveText(`Added ${title} ✓`);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }

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
  await expect(page.getByRole("button", { name: "Hold to exit Mary's view" })).toBeVisible();
  // Finish two habits, so the open ones stay on top and the done ones sink to the bottom.
  for (const title of ["Read a book together", "Tidy my toys"]) {
    await page.locator("button:not([disabled])").filter({ hasText: title }).first().click();
    await page.waitForTimeout(400);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(3500); // let the scene settle: the new sprout grows, then rests
  await page.screenshot({ path: `${OUT}/kid-view.png` });

  // Settings → Notifications: a non-default choice, and this device listed (a stand-in push
  // subscription, as in e2e/notifications.spec.ts: headless Chromium can't subscribe).
  await page.addInitScript(() => {
    const KEY = "readme-push-endpoint";
    const make = (endpoint: string) => ({
      endpoint,
      options: {},
      toJSON: () => ({ endpoint, keys: { p256dh: "readme-p256dh", auth: "readme-auth" } }),
      unsubscribe: async () => (localStorage.removeItem(KEY), true),
    });
    PushManager.prototype.getSubscription = async function () {
      const e = localStorage.getItem(KEY);
      return (e ? make(e) : null) as unknown as PushSubscription;
    };
    PushManager.prototype.subscribe = async function () {
      const e = `https://fcm.googleapis.com/fcm/send/readme-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(KEY, e);
      return make(e) as unknown as PushSubscription;
    };
    Notification.requestPermission = async () => "granted";
    Object.defineProperty(Notification, "permission", { get: () => "granted" });
  });
  await page.goto("/profile/settings");
  const section = page.getByRole("region", { name: "Notifications" });
  await section.getByRole("button", { name: "Turn on reminders" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Daily summary at").selectOption("8");
  await dialog.getByRole("button", { name: "Allow notifications" }).click();
  await expect(section.getByText(/^Reminders are on for this device/)).toBeVisible();
  await section.getByRole("group", { name: "Nudges" }).getByRole("radio", { name: "Inbox only" }).check();
  await section.getByRole("group", { name: "Group activity" }).getByRole("radio", { name: "Sound" }).check();
  await page.waitForLoadState("networkidle");
  await section.getByText("What to send").scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/notifications.png` });

  // Today offline: the banner, and one tap saved on the phone ("Saving…"). Same waits as e2e/offline.spec.ts.
  await page.goto("/today");
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready, navigator.serviceWorker.controller !== null))).toBe(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Check in: Read 20 min" })).toBeVisible();
  await expect.poll(() => page.evaluate(async () => {
    const hit = await caches.match("/today");
    return Boolean(hit) && (await hit!.text()).includes("Check in: Read 20 min");
  })).toBe(true);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Check in: Read 20 min" }).click();
  await expect(page.getByText("Saving… ☁️")).toBeVisible();
  await expect(page.getByText("Offline · showing your last update")).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/offline.png` });
  await context.setOffline(false);
});
