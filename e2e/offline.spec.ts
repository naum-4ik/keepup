// e2e/offline.spec.ts
// Check-ins with the network off (ideas/offline.md): queued on the phone, synced once when back.
import { expect, test, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./helpers/auth";
import { createGroup } from "./helpers/groups";
import { countCheckIns, countCheckInsOf, createHabit } from "./helpers/habits";

const BANNER = "Offline · showing your last update";

// The worker must control the page before a page can be saved for offline use; the reload goes
// through it, and the test waits until the copy (saved after its scripts) is in the cache.
// expect.poll + evaluate, not waitForFunction: that one doesn't await an async predicate.
// `containing`: text the saved copy must have (an older copy, from before the habit, may be there).
async function waitForWorker(page: Page, path: string, containing?: string) {
  await expect
    .poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready, navigator.serviceWorker.controller !== null)))
    .toBe(true);
  await page.reload();
  await waitForSaved(page, path, containing);
}

async function waitForSaved(page: Page, path: string, containing?: string) {
  await expect
    .poll(() => page.evaluate(async ([p, text]) => {
      const hit = await caches.match(p);
      return Boolean(hit) && (!text || (await hit!.text()).includes(text));
    }, [path, containing ?? ""] as const))
    .toBe(true);
}

async function addChild(page: Page, name: string): Promise<string> {
  await page.goto("/groups");
  await page.getByRole("link", { name: /Family/ }).click();
  await page.getByRole("link", { name: "Add a child" }).click();
  await page.getByLabel("Nickname").fill(name);
  await page.getByLabel("I'm this child's parent or guardian").check();
  await page.getByRole("button", { name: `Add ${name}` }).click();
  await expect(page).toHaveURL(/\/kids\/[0-9a-f-]{36}$/);
  return page.url().split("/").pop()!;
}

test("a check-in queued offline survives a reload and syncs once, for the day it was tapped", async ({ page, context }) => {
  await signUpAndOnboard(page);
  await createHabit(page, { title: "Walk", count: 1, period: "day" });
  const id = (await page.getByRole("link", { name: /Walk/ }).getAttribute("href"))!.split("/").pop()!;
  await waitForWorker(page, "/today", "Check in: Walk");

  await context.setOffline(true);
  await page.getByRole("button", { name: "Check in: Walk" }).click();
  await expect(page.getByText("Saving… ☁️")).toBeVisible();
  await expect(page.getByRole("button", { name: "Checked in today: Walk" })).toBeVisible();

  await page.reload(); // what a service-worker update does at a safe moment
  await expect(page.getByText(BANNER)).toBeVisible();
  await expect(page.getByText("Saving… ☁️")).toBeVisible();
  expect(countCheckIns(id)).toBe(0);

  await context.setOffline(false);
  await expect(page.getByText("Saving… ☁️")).toBeHidden();
  await expect(page.getByRole("button", { name: "Done: Walk" })).toBeVisible();
  await expect(page.getByText(BANNER)).toBeHidden();
  await page.reload();
  await expect(page.getByRole("button", { name: "Done: Walk" })).toBeVisible();
  expect(countCheckIns(id)).toBe(1);
});

test("signing out with a check-in not yet saved asks first; Stay signed in keeps it", async ({ page, context }) => {
  await signUpAndOnboard(page);
  await createHabit(page, { title: "Walk", count: 1, period: "day" });
  await context.setOffline(true);
  await page.getByRole("button", { name: "Check in: Walk" }).click();
  await expect(page.getByText("Saving… ☁️")).toBeVisible();
  // Back online, but the server can't be reached: the tap stays on the phone.
  await page.route("**/api/check-ins/sync", (route) => route.abort());
  await context.setOffline(false);
  await page.goto("/profile");

  await page.getByRole("button", { name: "Sign out" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("1 check-in hasn't been saved yet. Sign out anyway? It'll be removed from this phone.");
  await dialog.getByRole("button", { name: "Stay signed in" }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/profile$/);
  expect(await page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    return dbs.some((d) => d.name?.startsWith("keepup-offline-"));
  })).toBe(true);

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sign out anyway" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("offline, other pages say they need a connection", async ({ page, context }) => {
  await signUpAndOnboard(page);
  await waitForWorker(page, "/today");
  await context.setOffline(true);
  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
  await page.getByRole("link", { name: "Open Today" }).click();
  await expect(page.getByText(BANNER)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
});

test("the kid view offline: a tap plays and counts once, stays after a reload, and syncs once", async ({ page, context }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  const childId = await addChild(page, "Mary");
  await page.getByRole("link", { name: "Open Mary's view" }).click();
  await expect(page).toHaveURL(/\/play$/);
  await waitForWorker(page, `/kids/${childId}/play`);
  await expect(page.getByText("0 stars this week")).toBeAttached();

  await context.setOffline(true);
  const cards = page.getByRole("listitem");
  await page.getByRole("button", { name: /Tidy my toys/ }).click();
  await expect(page.getByRole("button", { name: "Tidy my toys , done" })).toBeVisible();
  await expect(page.getByText("1 star this week")).toBeAttached();
  await expect(page.locator("[data-items]")).toHaveAttribute("data-items", "1");
  // A queued tap counts as done for the order: the card still sinks to the bottom.
  await expect(cards.last()).toContainText("Tidy my toys", { timeout: 2500 });

  await page.reload();
  await expect(page.getByText(BANNER)).toBeVisible();
  await expect(page.getByRole("button", { name: "Tidy my toys , done" })).toBeVisible();
  await expect(page.getByText("1 star this week")).toBeAttached();
  await expect(cards.last()).toContainText("Tidy my toys");
  expect(countCheckInsOf(childId)).toBe(0);

  await context.setOffline(false);
  await expect.poll(() => countCheckInsOf(childId)).toBe(1);
  await expect(page.getByText(BANNER)).toBeHidden();
  await expect(page.getByText("1 star this week")).toBeAttached(); // never two
  await page.reload();
  await expect(page.getByText("1 star this week")).toBeAttached();
  await expect(page.getByRole("button", { name: "Tidy my toys , done" })).toBeVisible();
  expect(countCheckInsOf(childId)).toBe(1);
});

test("offline, Me + Mary needs a connection; Just me waits on the phone", async ({ page, context }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Mary");
  await page.goto("/habits/new");
  await page.getByRole("button", { name: "Create your own" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill("Walk the dog");
  await dialog.getByRole("radio", { name: "Family" }).check();
  await dialog.getByRole("switch", { name: "Include Mary" }).click();
  await dialog.getByRole("button", { name: /^Add habit/ }).click();
  await expect(page).toHaveURL(/\/today$/);
  await waitForWorker(page, "/today", "Check in: Walk the dog");

  await context.setOffline(true);
  await page.getByRole("button", { name: "Check in: Walk the dog" }).click();
  await page.getByRole("button", { name: "Me + Mary" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Needs a connection" })).toBeVisible();
  await page.getByRole("button", { name: "Check in: Walk the dog" }).click();
  await page.getByRole("button", { name: "Just me" }).click();
  // Only my check-in waits: Mary's row for the same habit doesn't say it's saving.
  await expect(page.getByRole("region", { name: "Family" }).getByText("Saving… ☁️")).toBeVisible();
  await expect(page.getByText("Saving… ☁️")).toHaveCount(1);
});

test("Today reached by client-side navigation is saved for offline use, and kept fresh after a check-in", async ({ page, context }) => {
  await signUpAndOnboard(page);
  await createHabit(page, { title: "Walk", count: 1, period: "day" });
  await waitForWorker(page, "/today", "Check in: Walk");
  await page.goto("/progress");
  await page.evaluate(() => caches.delete("keepup-pages"));
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Today" }).click();
  await expect(page).toHaveURL(/\/today$/);
  await waitForSaved(page, "/today");

  await page.getByRole("button", { name: "Check in: Walk" }).click(); // online
  await expect(page.getByRole("button", { name: "Done: Walk" })).toBeVisible();
  await expect(page.getByText("Saving… ☁️")).toHaveCount(0);
  await waitForSaved(page, "/today", "Done: Walk");
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(BANNER)).toBeVisible();
  await expect(page.getByRole("button", { name: "Done: Walk" })).toBeVisible();
});
