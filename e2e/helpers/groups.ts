import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { completeOnboarding, signUp, uniqueEmail } from "./auth";

export async function createGroup(page: Page, name: string, kind = "Family"): Promise<void> {
  await page.goto("/groups/new");
  await page.getByRole("radio", { name: kind }).check();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}/);
}

// The invite card shows the URL in a read-only input labelled "Invite link", so tests and people can select it.
export async function inviteLink(page: Page): Promise<string> {
  const link = page.getByRole("textbox", { name: "Invite link" });
  if (!(await link.isVisible())) await page.getByRole("button", { name: "Create invite link" }).click();
  return (await link.inputValue()).trim();
}

// Children can't be added from the UI until Task 10; add one straight into the local database with
// the service role (local stack only).
function localAdmin(): { url: string; key: string } {
  const raw = execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  // The CLI may print notices before the JSON (see scripts/local-env.mjs).
  const status = JSON.parse(raw.slice(raw.indexOf("{")));
  const url: string = status.API_URL;
  // Never send the service-role key anywhere but the local stack.
  const host = new URL(url).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") throw new Error(`Refusing to use the service role on ${url}`);
  return { url, key: status.SERVICE_ROLE_KEY };
}

export async function addChild(groupId: string, name: string): Promise<void> {
  const { url, key } = localAdmin();
  const res = await fetch(`${url}/rest/v1/profiles`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: randomUUID(), display_name: name, kind: "child", group_id: groupId }),
  });
  expect(res.ok, await res.text()).toBe(true);
}

// The invited flow from Task 7, from a fresh browser context: email sign-up from the invite, back
// to the invite, one tap on Join, then the invited onboarding.
export async function joinByLink(page: Page, url: string, name: string): Promise<void> {
  await page.goto(url);
  // "Continue with email" while Google is off (local stack); "Use email instead" next to Google.
  await page.getByRole("link", { name: /^(Continue with email|Use email instead)$/ }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Finvite%2F/);
  await page.getByRole("link", { name: "Sign up" }).click();
  // Wait for the sign-up page itself, so the form isn't filled on the page being left.
  await expect(page).toHaveURL(/\/signup\?next=%2Finvite%2F/);
  await signUp(page, uniqueEmail(name.toLowerCase()), { startOnSignupPage: true });
  await expect(page).toHaveURL(/\/invite\//);
  await page.getByRole("button", { name: /^Join / }).click();
  await completeOnboarding(page, { name, invited: true });
}

export async function createGroupHabitVia(page: Page, group: string, title: string): Promise<void> {
  await page.goto("/habits/new");
  await page.getByRole("button", { name: "Create your own" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByLabel("Category").selectOption("health");
  await dialog.getByRole("radio", { name: group }).check();
  await dialog.getByRole("button", { name: /^Add habit/ }).click();
  await expect(page).toHaveURL(/\/today$/);
}

// A group streak milestone only arrives when a period closes (cron, days in); seed the feed row the
// database would write, for every current member (local stack only).
export async function seedGroupMilestone(groupId: string, habitId: string, streak: number, period: "day" | "week" | "month"): Promise<void> {
  const { url, key } = localAdmin();
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const members = await fetch(`${url}/rest/v1/group_members?group_id=eq.${groupId}&left_at=is.null&select=user_id`, { headers });
  expect(members.ok, await members.clone().text()).toBe(true);
  const rows = ((await members.json()) as { user_id: string }[]).map((m) => ({
    user_id: m.user_id,
    kind: "group_milestone",
    group_id: groupId,
    habit_id: habitId,
    payload: { streak, period },
    dedupe_key: `group_milestone:${habitId}:e2e-${streak}:${m.user_id}`,
  }));
  const res = await fetch(`${url}/rest/v1/notifications`, { method: "POST", headers, body: JSON.stringify(rows) });
  expect(res.ok, await res.text()).toBe(true);
}

// The weekly family recap shows on the first day of the group's week (family_recaps(), the database's
// own clock). Moves the group to a time zone where today is a Sunday or Monday, starts its week then,
// and seeds one approved check-in last week (triggers off: a past day). False when no time zone has
// today as a Sunday or Monday. Local stack only.
export function seedRecapWeek(groupId: string, habitId: string): boolean {
  if (!/^[0-9a-f-]{36}$/.test(groupId) || !/^[0-9a-f-]{36}$/.test(habitId)) throw new Error("Not an id");
  const zones = ["Pacific/Kiritimati", "Pacific/Auckland", "Asia/Tokyo", "Asia/Kolkata", "Europe/Rome", "UTC",
    "America/New_York", "America/Los_Angeles", "Pacific/Honolulu", "Pacific/Pago_Pago"];
  const now = new Date();
  for (const tz of zones) {
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(now);
    const weekStart = weekday === "Sun" ? 0 : weekday === "Mon" ? 1 : null;
    if (weekStart === null) continue;
    execSync(`docker exec -i supabase_db_keepup psql -U postgres -d postgres -tA -v ON_ERROR_STOP=1`, {
      input: `
        update public.groups set timezone = '${tz}', week_start = ${weekStart} where id = '${groupId}';
        set session_replication_role = replica;
        insert into public.check_ins (habit_id, user_id, local_date, period_start, status, created_at, logged_by)
        select '${habitId}', m.user_id, d, d, 'approved', now() - interval '3 days', m.user_id
          from (select user_id from public.group_members where group_id = '${groupId}' and left_at is null limit 1) m,
               (select (now() at time zone '${tz}')::date - 3 as d) x;`,
      encoding: "utf8",
    });
    return true;
  }
  return false;
}

// Moves my membership in a group habit's group back (with startHabitDaysAgo, a group habit with past
// months on Progress → Calendar). Local stack only.
export function joinedDaysAgo(habitId: string, days: number): void {
  if (!/^[0-9a-f-]{36}$/.test(habitId) || !Number.isInteger(days)) throw new Error(`Bad input: ${habitId} ${days}`);
  execSync(`docker exec -i supabase_db_keepup psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q`, {
    input: `set session_replication_role = replica;
update public.group_members set joined_at = joined_at - interval '${days} days'
 where group_id = (select group_id from public.habits where id = '${habitId}');`,
    stdio: ["pipe", "ignore", "inherit"],
  });
}
