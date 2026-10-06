import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { completeOnboarding, setCelebrations, signUp, signUpAndOnboard, uniqueEmail } from "./helpers/auth";
import { createHabit } from "./helpers/habits";

test("a counted check-in floats +10 XP", async ({ page }) => {
  await signUpAndOnboard(page);
  await createHabit(page, { title: "Walk", count: 1, period: "day" });
  await page.getByRole("button", { name: "Check in: Walk" }).click();
  await expect(page.getByText("+10 XP")).toBeVisible();
});

test("a tap waiting on the phone floats +10 XP at once, and not again when it syncs", async ({ page, context }) => {
  await signUpAndOnboard(page);
  await createHabit(page, { title: "Walk", count: 1, period: "day" });
  // Counts every float element that mounts, so a second one after the sync can't slip by between checks.
  await page.evaluate(() => {
    const w = window as unknown as { xpFloats: number };
    w.xpFloats = 0;
    new MutationObserver((records) => {
      for (const r of records)
        for (const n of r.addedNodes)
          if (n instanceof Element) w.xpFloats += (n.matches("[data-xp-float]") ? 1 : 0) + n.querySelectorAll("[data-xp-float]").length;
    }).observe(document.body, { childList: true, subtree: true });
  });
  const floats = () => page.evaluate(() => (window as unknown as { xpFloats: number }).xpFloats);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Check in: Walk" }).click();
  await expect(page.getByText("+10 XP")).toBeVisible();
  await expect(page.getByText("+10 XP")).toHaveCount(0);
  expect(await floats()).toBe(1);
  await context.setOffline(false);
  await expect(page.getByRole("button", { name: "Done: Walk" })).toBeVisible();
  await page.waitForTimeout(1_500); // past a float's 900 ms, should the sync start one
  expect(await floats()).toBe(1);
});

test("five counted check-ins reach level 2: on the avatar and on Profile", async ({ page }) => {
  await signUpAndOnboard(page);
  for (const title of ["Walk", "Read", "Stretch", "Water", "Tidy"]) await createHabit(page, { title, count: 1, period: "day" });
  for (const title of ["Walk", "Read", "Stretch", "Water", "Tidy"]) {
    await page.getByRole("button", { name: `Check in: ${title}` }).click();
    await expect(page.getByRole("button", { name: `Done: ${title}` })).toBeVisible();
  }
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Level 2 · Seedling" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "XP to Level 3" })).toHaveAttribute("aria-valuenow", "0");
  await expect(page.getByText("150 XP to Level 3")).toBeVisible();
  const tab = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Profile, level 2, 0% to level 3", exact: true });
  await expect(tab.getByText("2", { exact: true })).toBeVisible();
});

test("the Profile tab's ring shows the way to the next level, on every tab", async ({ page }) => {
  await signUpAndOnboard(page);
  await createHabit(page, { title: "Walk", count: 1, period: "day" });
  await page.getByRole("button", { name: "Check in: Walk" }).click();
  await expect(page.getByRole("button", { name: "Done: Walk" })).toBeVisible();
  // 10 XP of the 50 to level 2.
  for (const path of ["/today", "/progress", "/profile"]) {
    await page.goto(path);
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Profile, level 1, 20% to level 2", exact: true })).toBeVisible();
    await expect(nav.getByTestId("xp-ring")).toHaveAttribute("data-progress", "0.20");
  }
});

test("Profile → Achievements shows earned badges in colour with the date, locked ones with a hint", async ({ page }) => {
  await signUpAndOnboard(page);
  await createHabit(page, { title: "Walk", count: 1, period: "day" });
  await page.getByRole("button", { name: "Check in: Walk" }).click();
  await expect(page.getByRole("button", { name: "Done: Walk" })).toBeVisible();
  await page.goto("/profile");
  await page.getByRole("navigation", { name: "Account" }).getByRole("link", { name: "Achievements" }).click();
  await expect(page).toHaveURL(/\/profile\/achievements$/);
  const badges = page.getByRole("region", { name: "Achievements" });
  await expect(badges).toContainText("2 of 24 earned"); // Planted and First step
  await expect(badges.getByRole("listitem", { name: /^First step, earned / })).toBeVisible();
  await expect(badges.getByRole("listitem", { name: "Bookworm, locked: 30 times done in Learning." })).toBeVisible();
});

test("the level-up moment plays once, on the next page, and closes on tap", async ({ page }) => {
  await signUpAndOnboard(page);
  await setCelebrations(page, "full");
  for (const title of ["Walk", "Read", "Stretch", "Water", "Tidy"]) await createHabit(page, { title, count: 1, period: "day" });
  await page.goto("/today");
  await page.keyboard.press("Escape"); // the Planted badge's moment, if it is showing
  for (const title of ["Walk", "Read", "Stretch", "Water", "Tidy"]) {
    await page.getByRole("button", { name: `Check in: ${title}` }).click();
    await expect(page.getByRole("button", { name: `Done: ${title}` })).toBeVisible();
  }
  // Nothing interrupts the run of check-ins on Today.
  await expect(page.getByRole("alertdialog", { name: "Celebration" })).toHaveCount(0);
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Progress" }).click();
  const moment = page.getByRole("alertdialog", { name: "Celebration" });
  await expect(moment).toContainText("Level 2");
  await moment.click();
  await expect(moment).toContainText("Unlocked");
  for (let i = 0; i < 4; i++) await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.getByRole("alertdialog", { name: "Celebration" })).toHaveCount(0);
});

test("Subtle shows a toast instead", async ({ page }) => {
  await signUpAndOnboard(page); // Subtle (signUp's default for tests)
  await createHabit(page, { title: "Walk", count: 1, period: "day" }); // lands on /today: a page opens
  await expect(page.getByRole("status", { name: "Celebration" })).toContainText("Planted");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});

test("Settings → Celebrations remembers Full or Subtle", async ({ page }) => {
  await signUpAndOnboard(page);
  await setCelebrations(page, "full");
  await page.reload();
  await expect(page.getByRole("radiogroup", { name: "Celebrations" }).getByRole("radio", { name: "Full" })).toBeChecked();
});

// Whether a badge of this account is still unseen, read from the local test database.
function badgeUnseen(email: string, code: string): boolean {
  const out = execSync(`docker exec -i supabase_db_keepup psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -At`, {
    input: `select count(*) from public.user_achievements a join auth.users u on u.id = a.user_id where u.email = '${email}' and a.achievement_code = '${code}' and a.seen_at is null;`,
  });
  return out.toString().trim() === "1";
}

test("a page opened in a hidden tab shows and marks nothing until the tab is looked at", async ({ page }) => {
  // The tab's visibility, under the test's control.
  await page.addInitScript(() => {
    const w = window as unknown as { tabHidden: boolean };
    w.tabHidden = false;
    Object.defineProperty(document, "visibilityState", { get: () => (w.tabHidden ? "hidden" : "visible") });
    Object.defineProperty(document, "hidden", { get: () => w.tabHidden });
  });
  const email = uniqueEmail();
  await signUp(page, email);
  await completeOnboarding(page);
  await page.addInitScript(() => ((window as unknown as { tabHidden: boolean }).tabHidden = true));
  await createHabit(page, { title: "Walk", count: 1, period: "day" }); // Planted, on a page that opens hidden
  await page.waitForTimeout(2_000);
  await expect(page.getByRole("status", { name: "Celebration" })).toHaveCount(0);
  expect(badgeUnseen(email, "planted")).toBe(true);
  await page.evaluate(() => {
    (window as unknown as { tabHidden: boolean }).tabHidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByRole("status", { name: "Celebration" })).toContainText("Planted");
  await expect.poll(() => badgeUnseen(email, "planted")).toBe(false);
});

test("Escape closes the moment, not a dialog underneath it", async ({ page }) => {
  await signUpAndOnboard(page);
  await setCelebrations(page, "full");
  await createHabit(page, { title: "Walk", count: 1, period: "day" });
  const moment = page.getByRole("alertdialog", { name: "Celebration" });
  await expect(moment).toContainText("Planted");
  await expect(moment).toContainText("Tap or press Esc");
  // A key listener of the page (as a dialog's) must not see the Escape the moment took.
  await page.evaluate(() => {
    const w = window as unknown as { pageEscapes: number };
    w.pageEscapes = 0;
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") w.pageEscapes += 1;
    });
  });
  await page.keyboard.press("Escape");
  await expect(moment).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { pageEscapes: number }).pageEscapes)).toBe(0);
});
