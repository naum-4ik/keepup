import { expect, test } from "./fixtures";
import { signUpAndOnboard } from "./helpers/auth";
import { createGroup, createGroupHabitVia } from "./helpers/groups";
import { createHabit, endHabitYesterday, weekIncludesYesterday } from "./helpers/habits";

test("the Today summary counts today's habits, says what's left, and celebrates the last one", async ({ page }) => {
  await signUpAndOnboard(page);
  await createHabit(page, { title: "Walk", count: 1, period: "day" });
  await createHabit(page, { title: "Read", count: 1, period: "day" });
  await createHabit(page, { title: "Stretch", count: 1, period: "day" });

  const summary = page.getByRole("region", { name: "Today's progress" });
  await expect(summary.getByRole("status")).toHaveText("Check in 3 more to finish today.");
  await expect(summary.getByRole("img", { name: "0 of 3 done today" })).toBeVisible();

  await page.getByRole("button", { name: "Check in: \u2068Walk\u2069" }).click();
  await expect(summary.getByRole("status")).toHaveText("1 of 3 done. Check in 2 more to finish today.");

  await page.getByRole("button", { name: "Check in: \u2068Read\u2069" }).click();
  await expect(summary.getByRole("status")).toHaveText("Check in 1 more to finish today (2 of 3).");

  await page.getByRole("button", { name: "Check in: \u2068Stretch\u2069" }).click();
  // Day 1 of each streak: the line names the streak it keeps.
  await expect(summary.getByRole("status")).toHaveText("All 3 done 🎉 Your 1-day streak is safe.");
});

test("a check-in on Today is confirmed in a toast, and its Undo takes it back", async ({ page }) => {
  await signUpAndOnboard(page);
  await createHabit(page, { title: "Walk", count: 1, period: "day" });
  await page.getByRole("button", { name: "Check in: \u2068Walk\u2069" }).click();
  await expect(page.getByRole("button", { name: "Done: \u2068Walk\u2069" })).toBeVisible();
  // The toast's words are read from its polite live region (components/ui/toast.tsx); Undo is its button.
  const toast = page.getByTestId("toast-live");
  await expect(toast).toHaveText("\u2068Walk\u2069 checked in");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(toast).toHaveText("\u2068Walk\u2069: check-in undone");
  await expect(page.getByRole("button", { name: "Check in: \u2068Walk\u2069" })).toBeEnabled();
  await expect(page.getByRole("region", { name: "Today's progress" }).getByRole("status")).toHaveText("Check in 1 more to finish today.");
});

test("with nothing due today, the card doesn't claim the day is done", async ({ page }) => {
  await signUpAndOnboard(page);
  await createHabit(page, { title: "Walk", count: 1, period: "day" });
  const id = (await page.getByRole("link", { name: /Walk/ }).getAttribute("href"))!.split("/").pop()!;
  endHabitYesterday(id);
  // Its days stay in this week on any weekday (on the week's first day there'd be no week to show).
  weekIncludesYesterday(id);
  await page.reload();
  const card = page.getByRole("region", { name: "Today's progress" });
  await expect(card).not.toContainText("done");
  await expect(card.getByRole("link", { name: /^This week/ })).toBeVisible();
});


test("the Today card's This week counts a group habit you take part in", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await createGroupHabitVia(page, "Family", "Walk");
  const card = page.getByRole("region", { name: "Today's progress" });
  // A group habit used to leave the week line out ("0 of 0", or no line at all).
  await expect(card.getByRole("img", { name: "0 of 1 goal met this week" })).toBeVisible();
  await page.getByRole("button", { name: "Check in: \u2068Walk\u2069" }).click();
  await expect(card.getByRole("img", { name: "1 of 1 goal met this week" })).toBeVisible();
});

// Owner rule 4: the first check-in is on the first screen, at least 44×44, and above the bottom nav,
// on small and common phones (design audit 2026-10-19: at 320×640 it was under the nav).
for (const viewport of [
  { width: 320, height: 640 },
  { width: 375, height: 812 },
  { width: 414, height: 896 },
]) {
  test(`at ${viewport.width}×${viewport.height} the first check-in is on the first screen, above the nav`, async ({ page }) => {
    await signUpAndOnboard(page);
    for (const title of ["Walk", "Read", "Stretch"]) await createHabit(page, { title, count: 1, period: "day" });
    await page.setViewportSize(viewport);
    await page.goto("/today");
    const first = page.getByRole("button", { name: /^Check in: / }).first();
    await expect(first).toBeVisible();
    const box = (await first.boundingBox())!;
    const nav = (await page.getByRole("navigation", { name: "Main", exact: true }).boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    // At load, without scrolling: inside the viewport and clear of the nav.
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(nav.y);
  });
}
