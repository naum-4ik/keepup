import { expect, test, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./helpers/auth";
import { createGroup, createGroupHabitVia, inviteLink, joinByLink } from "./helpers/groups";
import { endHabitYesterday } from "./helpers/habits";

async function openGroup(page: Page, groupName: string) {
  await page.goto("/groups");
  await page.getByRole("link", { name: new RegExp(groupName) }).click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);
}

async function addChild(page: Page, groupName: string, name: string, gender?: "Boy" | "Girl") {
  await openGroup(page, groupName);
  await page.getByRole("link", { name: "Add a child" }).click();
  await page.getByLabel("Nickname").fill(name);
  if (gender) await page.getByRole("group", { name: "Boy or girl" }).getByLabel(gender).check();
  await page.getByRole("group", { name: "Avatar" }).getByRole("button", { name: "🐼" }).click();
  await expect(page.getByRole("button", { name: `Add ${name}` })).toBeDisabled();
  await page.getByLabel("I'm this child's parent or guardian").check();
  await page.getByRole("button", { name: `Add ${name}` }).click();
  await expect(page).toHaveURL(/\/kids\/[0-9a-f-]{36}$/);
}

test("add a child with the three starter habits, check in for her on Today, and see a star", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  await expect(page.getByRole("region", { name: "Habits" }).getByRole("listitem")).toHaveCount(3);
  await page.goto("/today");
  const mary = page.getByRole("region", { name: /Mary/ });
  await mary.getByRole("button", { name: "Check in for \u2068Mary\u2069: \u2068Tidy my toys\u2069" }).click();
  await expect(mary).toContainText("⭐ 1");
});

test("a kid's boy or girl is optional, chosen when adding, and changed later", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mia", "Girl");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const edit = page.getByRole("dialog");
  const pick = edit.getByRole("group", { name: "Boy or girl" });
  await expect(pick.getByLabel("Girl")).toBeChecked();
  await expect(pick.getByLabel("Boy")).not.toBeChecked();
  await pick.getByLabel("Boy").check();
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(edit.getByRole("button", { name: "Saved" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("dialog").getByLabel("Boy")).toBeChecked();
});

test("a kid's boy or girl can be cleared again with Not set", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mia");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  let edit = page.getByRole("dialog");
  let pick = edit.getByRole("group", { name: "Boy or girl" });
  await expect(pick.getByLabel("Not set")).toBeChecked();
  await expect(pick).toHaveAccessibleDescription(/Russian and Hebrew/);
  await pick.getByLabel("Girl").check();
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(edit.getByRole("button", { name: "Saved" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  edit = page.getByRole("dialog");
  pick = edit.getByRole("group", { name: "Boy or girl" });
  await expect(pick.getByLabel("Girl")).toBeChecked();
  await pick.getByLabel("Not set").check();
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(edit.getByRole("button", { name: "Saved" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("group", { name: "Boy or girl" }).getByLabel("Not set")).toBeChecked();
});

test("Add a child: the guardian box comes first, remove a starter habit, choose more in the dialog", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await openGroup(page, "Family");
  await page.getByRole("link", { name: "Add a child" }).click();
  await page.getByLabel("Nickname").fill("Leo");
  const habits = page.getByRole("region", { name: "Habits to start" });
  await expect(habits.getByRole("listitem")).toHaveCount(3);
  await habits.getByRole("button", { name: "Remove Tidy my toys" }).click();
  await expect(habits.getByRole("listitem")).toHaveCount(2);

  await habits.getByRole("button", { name: "Choose more habits" }).click();
  const dialog = page.getByRole("dialog", { name: "Habits to start" });
  await expect(dialog.getByRole("button", { name: /Brush teeth/ })).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: /Bath time/ }).click();
  await dialog.getByRole("button", { name: /Play outside/ }).click();
  await dialog.getByRole("button", { name: "Done · 4 picked" }).click();
  await expect(dialog).toBeHidden();
  await expect(habits.getByRole("listitem")).toHaveCount(4);

  // The button stays in reach above the bottom nav.
  const add = page.getByRole("button", { name: "Add Leo" });
  await expect(add).toBeInViewport();
  const nav = await page.getByRole("navigation", { name: "Main" }).boundingBox();
  expect((await add.boundingBox())!.y + (await add.boundingBox())!.height).toBeLessThanOrEqual(nav!.y);
  await page.getByLabel("I'm this child's parent or guardian").check();
  await add.click();
  await expect(page).toHaveURL(/\/kids\/[0-9a-f-]{36}$/);
  const list = page.getByRole("region", { name: "Habits" });
  await expect(list.getByRole("listitem")).toHaveCount(4);
  await expect(list).toContainText("Bath time");
  await expect(list).not.toContainText("Tidy my toys");
});

test("an admin of a family group with no children sees Add a child?, which opens the form", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  const groupId = page.url().match(/\/groups\/([0-9a-f-]{36})/)![1];
  await createGroupHabitVia(page, "Family", "Walk");
  const prompt = page.getByText("Add a child: each check-in earns 1 star toward a treat.");
  await expect(prompt).toBeHidden(); // not before the first check-in
  await page.getByRole("button", { name: "Check in: \u2068Walk\u2069" }).click();
  await expect(page.getByRole("button", { name: "Done: \u2068Walk\u2069" })).toBeVisible();
  await page.reload();
  await expect(prompt).toBeVisible();
  await page.getByRole("link", { name: "Add a child", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/kids/new\\?group=${groupId}$`));
  await expect(page.getByLabel("Nickname")).toBeVisible();
});

test("the kid view: big buttons, a tap counts at once, and hold to exit", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  await page.getByRole("link", { name: "Open \u2068Mary\u2069's view" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
  // For a toddler: no counts or "what's next" here (they're on the kid page), just the scene.
  await expect(page.getByText(/more ⭐ to/)).toHaveCount(0);
  const items = page.locator("[data-items]");
  await expect(items).toHaveAttribute("data-items", "0");
  const teeth = page.getByRole("button", { name: /Brush teeth/ });
  await teeth.click();
  await expect(page.getByText("1 star this week")).toBeAttached(); // for screen readers
  await expect(items).toHaveAttribute("data-items", "1"); // each tap adds one thing to the scene
  await teeth.click(); // a toddler's quick double tap counts once
  await expect(page.getByText("1 star this week")).toBeAttached();
  await page.waitForTimeout(2100);
  await teeth.click(); // 2× a day: the second one, after a pause
  await expect(page.getByText("2 stars this week")).toBeAttached();
  await expect(page.getByRole("button", { name: "Brush teeth , done" })).toBeVisible();
  await page.getByRole("button", { name: "Brush teeth , done" }).click(); // done: a wiggle, nothing counted
  await page.waitForTimeout(500);
  await expect(page.getByText("2 stars this week")).toBeAttached();
  await expect(items).toHaveAttribute("data-items", "2");
  // Kids earn XP behind the scenes only: no XP or level anywhere in their view (owner 2026-10-06).
  await expect(page.getByRole("main")).not.toContainText(/\bXP\b|\blevel\b/i);
  // Sound is on by default; the grown-up can mute it, and it's remembered on this phone.
  const sound = page.getByRole("button", { name: "Sound" });
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  await sound.click();
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(page.getByRole("button", { name: "Sound" })).toHaveAttribute("aria-pressed", "false");
  const exit = page.getByRole("button", { name: "Hold to exit \u2068Mary\u2069's view" });
  await exit.click(); // a quick tap does nothing
  await expect(page).toHaveURL(/\/play$/);
  await exit.hover();
  await page.mouse.down();
  // It closes once the hold is done, with the finger still down.
  await expect(page).toHaveURL(/\/kids\/[0-9a-f-]{36}$/, { timeout: 4000 });
  await page.mouse.up();
  await expect(page.getByText("Mary did it")).toHaveCount(2); // both taps, logged as by Mary
  // What's next and when it starts over are for the grown-up, on the kid page.
  const garden = page.getByRole("region", { name: "This week's garden" });
  await expect(garden).toContainText("1 more star to a sprout 🌱");
  await expect(garden).toContainText(/A new garden starts on \w+day 🌱/);
  await expect(garden.locator("[data-items]")).toHaveAttribute("data-items", "2");
  // Nor on the child's page (the Profile tab's level is the grown-up's own).
  await expect(page.getByRole("main")).not.toContainText(/\bXP\b|\blevel\b/i);
});

test("Me + Mary checks in both in one tap", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  await page.goto("/habits/new");
  await page.getByRole("button", { name: "Create your own" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill("Walk the dog");
  await dialog.getByLabel("Category").selectOption("health");
  await dialog.getByRole("radio", { name: "Family" }).check();
  await dialog.getByRole("switch", { name: "Include Mary" }).click();
  await dialog.getByRole("button", { name: /^Add habit/ }).click();
  await page.getByRole("button", { name: "Check in: \u2068Walk the dog\u2069" }).click();
  await page.getByRole("button", { name: "Me + Mary" }).click();
  await expect(page.getByText("Everyone did it ✓")).toBeVisible();
});

test("Me + Mary from the group habit's page checks in both", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  await page.goto("/habits/new");
  await page.getByRole("button", { name: "Create your own" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill("Walk the dog");
  await dialog.getByLabel("Category").selectOption("health");
  await dialog.getByRole("radio", { name: "Family" }).check();
  await dialog.getByRole("switch", { name: "Include Mary" }).click();
  await dialog.getByRole("button", { name: /^Add habit/ }).click();
  await page.getByRole("link", { name: /Walk the dog/ }).click();
  await expect(page).toHaveURL(/\/habits\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Check in: \u2068Walk the dog\u2069" }).click();
  await page.getByRole("button", { name: "Me + Mary" }).click();
  await expect(page.getByText("Everyone did it ✓")).toBeVisible();
  const together = page.getByRole("region", { name: "Together" });
  await expect(together.getByRole("listitem").filter({ hasText: "Mary" })).toContainText("Done");
});

test("the last adult leaving is warned about the child and can export first", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  await openGroup(page, "Family");
  await page.getByRole("button", { name: "Leave group" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Leave group" }).click();
  const warn = page.getByRole("dialog");
  await expect(warn).toContainText("Mary's profile and history will be deleted.");
  const download = page.waitForEvent("download");
  await warn.getByRole("button", { name: "Export first" }).click();
  expect((await download).suggestedFilename()).toMatch(/^keepup-Mary-\d{4}-\d{2}-\d{2}\.json$/);
  await warn.getByRole("button", { name: "Delete anyway" }).click();
  await expect(page).toHaveURL(/\/groups$/);
});

test("another adult in the group sees and logs for the child", async ({ page, browser }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  // addChild ends on Mary's page; the invite card is on the group page.
  await openGroup(page, "Family");
  const url = await inviteLink(page);
  const guest = await (await browser.newContext()).newPage();
  await joinByLink(guest, url, "Dan");
  await guest.goto("/today");
  await guest.getByRole("region", { name: /Mary/ }).getByRole("button", { name: "Check in for \u2068Mary\u2069: \u2068Tidy my toys\u2069" }).click();
  await expect(guest.getByRole("region", { name: /Mary/ })).toContainText("⭐ 1");
  await page.goto("/inbox");
  await page.getByRole("tab", { name: "Activity" }).click();
  await expect(page.getByText(/Dan\u2069 logged \u2068Tidy my toys\u2069 for \u2068Mary/)).toBeVisible();
});

test("add a habit for a child from the dialog: a suggestion, then your own", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  await page.getByRole("button", { name: "Add a habit" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a habit for Mary" });
  await expect(dialog.getByRole("region", { name: "Helping at home" })).toBeVisible();
  await dialog.getByRole("button", { name: "Add Make my bed" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Added Make my bed ✓");
  await expect(dialog.getByRole("button", { name: "Add Make my bed" })).toHaveCount(0); // she has it now

  await dialog.getByRole("button", { name: "Create your own" }).click();
  const own = page.getByRole("dialog", { name: "Your own habit for Mary" });
  await own.getByLabel("Title").fill("Feed the fish");
  await own.getByRole("group", { name: "Picture" }).getByRole("button", { name: "🐶" }).click();
  await own.getByRole("button", { name: "Add habit" }).click();
  await expect(own).toBeHidden();
  // The dialog closed; the toast says what a check-in earns (it repeats the title: scope to main).
  await expect(page.getByTestId("toast-live")).toHaveText("Added \u2068Feed the fish\u2069 for \u2068Mary\u2069. Each check-in earns 1 star.");
  await expect(page.getByRole("main").getByText("Feed the fish")).toBeVisible();
  await expect(page.getByRole("main").getByText("Make my bed")).toBeVisible();
});

test("a treat goal from an idea, with a quick star target", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  const goal = page.getByRole("region", { name: "Treat goal" });
  await goal.getByRole("button", { name: "Set a goal" }).click();
  const ideas = goal.getByRole("group", { name: "Choose a treat together" });
  await expect(goal.getByRole("button", { name: "Set goal" })).toBeDisabled(); // pick something first
  await expect(ideas.getByRole("button", { name: /Stay up late/ })).toHaveCount(0); // six ideas first
  await ideas.getByRole("button", { name: "More ideas" }).click();
  await ideas.getByRole("button", { name: /Pizza night/ }).click();
  await expect(goal.getByLabel("Treat", { exact: true })).toHaveValue("Pizza night");
  await expect(goal.getByRole("button", { name: "Picture: 🍕. Change" })).toBeVisible();
  await goal.getByLabel("Treat", { exact: true }).fill("Pizza night with grandma"); // an idea can be edited
  await goal.getByRole("button", { name: "Picture: 🍕. Change" }).click();
  await goal.getByRole("group", { name: "Treat emoji" }).getByRole("button", { name: "🎈" }).click();
  await expect(goal.getByRole("button", { name: "Picture: 🎈. Change" })).toBeVisible();
  await goal.getByRole("button", { name: "⭐ 30" }).click();
  await goal.getByRole("button", { name: "Set goal" }).click();
  // Said where it happened (the form gave way to the goal).
  await expect(goal.getByRole("status")).toHaveText("Goal set: Pizza night with grandma. Each check-in earns 1 star toward it.");
  await expect(goal).toContainText("⭐ 0 of 30");
});

test("a treat goal of our own, with another star count", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  const goal = page.getByRole("region", { name: "Treat goal" });
  await goal.getByRole("button", { name: "Set a goal" }).click();
  await goal.getByRole("button", { name: "Our own idea" }).click();
  await goal.getByLabel("Treat", { exact: true }).fill("Trip to the aquarium");
  await goal.getByRole("button", { name: "Other" }).click();
  await goal.getByLabel("Stars", { exact: true }).fill("15");
  await goal.getByRole("button", { name: "Set goal" }).click();
  await expect(goal).toContainText("Trip to the aquarium");
  await expect(goal).toContainText("⭐ 0 of 15");

  // Cancel asks first; Keep goal leaves it.
  await goal.getByRole("button", { name: "Cancel goal" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Cancel the goal?");
  await dialog.getByRole("button", { name: "Keep goal" }).click();
  await expect(goal).toContainText("Trip to the aquarium");
  await goal.getByRole("button", { name: "Cancel goal" }).click();
  await dialog.getByRole("button", { name: "Cancel goal" }).click();
  await expect(goal.getByRole("button", { name: "Set a goal" })).toBeVisible();
  await expect(goal.getByRole("status")).toHaveText("Cancelled Trip to the aquarium. Mary keeps all the stars.");
});

test("choose what grows with the child: the kid page and the kid view switch theme", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  const picker = page.getByRole("region", { name: "What grows" });
  await expect(picker.getByRole("button", { name: /Garden/ })).toHaveAttribute("aria-pressed", "true");
  await picker.getByRole("button", { name: /Aquarium/ }).click();
  await expect(picker.getByRole("button", { name: /Aquarium/ })).toHaveAttribute("aria-pressed", "true");
  // Saved: a toast with the kid view a tap away (where the change shows).
  await expect(page.getByTestId("toast-live")).toHaveText("Changed to Aquarium. This week's stars stay the same.");
  await expect(page.locator("[data-toaster]").getByRole("link", { name: "Open \u2068Mary\u2069's view" })).toHaveAttribute("href", /\/kids\/[0-9a-f-]{36}\/play$/);
  await expect(page.getByRole("region", { name: "This week's aquarium" })).toBeVisible();
  await page.reload(); // saved
  await expect(page.getByRole("region", { name: "What grows" }).getByRole("button", { name: /Aquarium/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("main").getByRole("link", { name: "Open \u2068Mary\u2069's view" }).click();
  await expect(page.getByRole("img", { name: "Clear water" })).toBeVisible();
});

test("reset a child's profile: export first is offered, and only the nickname and avatar stay", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  await expect(page.getByText("Brush teeth")).toBeVisible();
  const zone = page.getByRole("region", { name: "Danger zone" });
  await zone.getByRole("button", { name: "Reset \u2068Mary\u2069's profile" }).click();
  const dialog = page.getByRole("dialog", { name: "Reset Mary's profile?" });
  await expect(dialog).toContainText("Everything except Mary's nickname and avatar is cleared");
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export first" }).click();
  expect((await download).suggestedFilename()).toMatch(/^keepup-Mary-\d{4}-\d{2}-\d{2}\.json$/);
  await dialog.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(zone.getByRole("status")).toHaveText("Mary's profile is reset. A fresh start 🌱");
  // The empty list says what fills it, with Add a habit right under it.
  const habits = page.getByRole("region", { name: "Habits" });
  await expect(habits).toContainText("Add a habit for Mary: each check-in earns 1 star.");
  await expect(habits.getByRole("button", { name: "Add a habit" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mary" })).toBeVisible();
});


test("closing a dialog with Escape hands focus back to the button that opened it", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await openGroup(page, "Family");
  await page.getByRole("link", { name: "Add a child" }).click();
  const opener = page.getByRole("region", { name: "Habits to start" }).getByRole("button", { name: "Choose more habits" });
  await opener.click();
  await expect(page.getByRole("dialog", { name: "Habits to start" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(opener).toBeFocused();
});

test("a group habit with a child that ended leaves the kid views, and Start again keeps the child in", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  const kidPage = new URL(page.url()).pathname;
  await page.goto("/habits/new");
  await page.getByRole("button", { name: "Create your own" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill("Walk the dog");
  await dialog.getByLabel("Category").selectOption("health");
  await dialog.getByRole("radio", { name: "Family" }).check();
  await dialog.getByRole("switch", { name: "Include Mary" }).click();
  await dialog.getByRole("button", { name: /^Add habit/ }).click();
  await expect(page).toHaveURL(/\/today$/);
  const mary = page.getByRole("region", { name: "Mary", exact: true });
  await expect(mary).toContainText("Walk the dog");
  const id = (await page.getByRole("link", { name: /Walk the dog/ }).first().getAttribute("href"))!.split("/").pop()!;

  endHabitYesterday(id);
  await page.reload();
  await expect(page.getByRole("region", { name: "\u2068Walk the dog\u2069 is finished" })).toBeVisible();
  await expect(mary).not.toContainText("Walk the dog");
  await page.goto(kidPage);
  await expect(page.getByRole("region", { name: "Habits" })).toContainText("Tidy my toys");
  await expect(page.getByRole("region", { name: "Habits" })).not.toContainText("Walk the dog");
  await page.goto(`${kidPage}/play`);
  await expect(page.getByText("Tidy my toys")).toBeVisible();
  await expect(page.getByText("Walk the dog")).toHaveCount(0);

  await page.goto("/today");
  await page.getByRole("region", { name: "\u2068Walk the dog\u2069 is finished" }).getByRole("button", { name: "Finish" }).click();
  await expect(page.getByRole("region", { name: "\u2068Walk the dog\u2069 is finished" })).toBeHidden();
  await page.goto("/progress?view=finished");
  await page.getByRole("button", { name: "Start \u2068Walk the dog\u2069 again" }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole("region", { name: "Mary", exact: true })).toContainText("Walk the dog");
});

test("the kid view: the third star brings the sprout, and the last habit of the day makes the scene dance", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  await page.getByRole("link", { name: "Open \u2068Mary\u2069's view" }).click();
  await expect(page).toHaveURL(/\/play$/); // the kid page shows the same picture: tap only in the kid view
  await expect(page.getByRole("img", { name: "A seed in the soil" })).toBeVisible();
  await page.getByRole("button", { name: /Read a book together/ }).click();
  await page.getByRole("button", { name: /Tidy my toys/ }).click();
  await page.getByRole("button", { name: /Brush teeth/ }).click();
  await expect(page.getByRole("img", { name: "A sprout" })).toBeVisible(); // 3 stars: the next picture
  // After the three items' reveals (quick taps wait their turn), the new picture zooms in big over the
  // screen for ~2 s, then settles into the scene.
  await expect(page.locator("[data-milestone]")).toHaveText("🌱", { timeout: 8000 });
  await expect(page.locator("[data-milestone]")).toHaveCount(0, { timeout: 4000 });
  await expect(page.locator("[data-items]")).toHaveAttribute("data-items", "3");
  await page.getByRole("button", { name: /Brush teeth/ }).click(); // the last one today
  // The scene dances once its item has landed.
  await expect(page.locator("[data-items] .animate-dance").first()).toBeAttached({ timeout: 5000 });
  await expect(page.locator("[data-items] .animate-dance")).toHaveCount(0, { timeout: 4000 }); // ~2 seconds, then still
});

// A child with five habits: the three starters, plus Bath time and Play outside.
async function addChildWithFiveHabits(page: Page, groupName: string, name: string) {
  await openGroup(page, groupName);
  await page.getByRole("link", { name: "Add a child" }).click();
  await page.getByLabel("Nickname").fill(name);
  await page.getByRole("group", { name: "Avatar" }).getByRole("button", { name: "🐼" }).click();
  const habits = page.getByRole("region", { name: "Habits to start" });
  await habits.getByRole("button", { name: "Choose more habits" }).click();
  const dialog = page.getByRole("dialog", { name: "Habits to start" });
  await dialog.getByRole("button", { name: /Bath time/ }).click();
  await dialog.getByRole("button", { name: /Play outside/ }).click();
  await dialog.getByRole("button", { name: "Done · 5 picked" }).click();
  await expect(habits.getByRole("listitem")).toHaveCount(5);
  await page.getByLabel("I'm this child's parent or guardian").check();
  await page.getByRole("button", { name: `Add ${name}` }).click();
  await expect(page).toHaveURL(/\/kids\/[0-9a-f-]{36}$/);
}

test("the kid view with five habits: a done card slides to the bottom, and the picture stays in sight", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChildWithFiveHabits(page, "Family", "Mary");
  await page.getByRole("link", { name: "Open \u2068Mary\u2069's view" }).click();
  await expect(page).toHaveURL(/\/play$/);
  const cards = page.getByRole("listitem");
  await expect(cards).toHaveCount(5);
  // The first card that one tap finishes (Brush teeth is 2× a day).
  const titles = await cards.allInnerTexts();
  const first = titles.findIndex((t) => !t.includes("Brush teeth"));
  const title = titles[first].trim().split("\n").pop()!.trim(); // the emoji comes first
  await cards.nth(first).getByRole("button").click();
  // It turns green and stays put while the star flies…
  await expect(page.getByRole("button", { name: `${title} , done` })).toBeVisible();
  await expect(cards.nth(first)).toContainText(title);
  // …then about a second later it slides to the bottom. The move doesn't take the focus.
  const sound = page.getByRole("button", { name: "Sound" });
  await sound.focus();
  await expect(cards.last()).toContainText(title, { timeout: 4000 });
  await expect(sound).toBeFocused();
  // A reload keeps the order: open first, done last.
  await page.reload();
  await expect(cards.last()).toContainText(title);

  // Scrolled down to the last card, the picture stays at the top of the screen, smaller.
  await cards.last().scrollIntoViewIfNeeded();
  await expect(page.locator("[data-shrunk]")).toBeAttached();
  const picture = (await page.getByRole("img", { name: "A seed in the soil" }).boundingBox())!;
  expect(picture.y).toBeGreaterThanOrEqual(0);
  expect(picture.y + picture.height).toBeLessThanOrEqual(844);
  await expect(cards.last()).toBeInViewport();
  // Back at the top, it's full size again.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator("[data-shrunk]")).toHaveCount(0);
});

test("the kid view's idle motion: the scene moves gently, and not at all with Reduce Motion", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  await page.getByRole("link", { name: "Open \u2068Mary\u2069's view" }).click();
  await page.getByRole("button", { name: /Tidy my toys/ }).click();
  await expect(page.locator("[data-items]")).toHaveAttribute("data-items", "1");
  const idleRunning = () =>
    page.evaluate(() => document.getAnimations().filter((a) => a instanceof CSSAnimation && a.animationName.startsWith("idle-") && a.playState === "running").length);
  await expect.poll(idleRunning, { timeout: 4000 }).toBeGreaterThan(0);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(page.locator("[data-items]")).toHaveAttribute("data-items", "1");
  await page.waitForTimeout(500);
  expect(await idleRunning()).toBe(0);
  await expect(page.locator('[data-idle="drift"], [data-idle="sparkle"]')).toHaveCount(0);
});

test("the kid view: while a done card slides down, a card that isn't moving still takes a tap", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChildWithFiveHabits(page, "Family", "Mary");
  await page.getByRole("link", { name: "Open \u2068Mary\u2069's view" }).click();
  const cards = page.getByRole("listitem");
  await expect(cards).toHaveCount(5);
  // A one-tap card below the first, so the first card stays where it is when it slides down.
  const titles = (await cards.allInnerTexts()).map((t) => t.trim().split("\n").pop()!.trim());
  const second = titles.findIndex((t, i) => i > 0 && t !== "Brush teeth");
  await cards.nth(second).getByRole("button").click();
  await expect(page.getByText("1 star this week")).toBeAttached();
  // The slide starts once its item has landed (the list order changes at once; the cards move for ~350 ms)…
  await expect(cards.last()).toContainText(titles[second], { timeout: 4000 });
  // …and the first card, which isn't moving, counts a tap right away.
  await cards.first().getByRole("button").click();
  await expect(page.getByText("2 stars this week")).toBeAttached();
});

// Follows the big reveal frame by frame until it's gone (optionally scrolling the list as it starts to
// fly, so the sticky picture shrinks mid-flight); then how far its last centre is from the real item's.
async function landingOffset(page: Page, index: number, scrollMidFlight = false): Promise<number> {
  return page.evaluate(
    ([i, scroll]) =>
      new Promise<number>((resolve) => {
        let last: DOMRect | null = null;
        let scrolled = false;
        const centre = (r: DOMRect) => [r.left + r.width / 2, r.top + r.height / 2];
        const tick = () => {
          const glyph = document.querySelector("[data-reveal-glyph]");
          if (glyph) {
            if (scroll && !scrolled && document.querySelector('[data-reveal][data-phase="fly"]')) {
              scrolled = true;
              window.scrollBy(0, 400);
            }
            last = glyph.getBoundingClientRect();
            requestAnimationFrame(tick);
            return;
          }
          const item = document.querySelector(`[data-item="${i}"] > span > span`);
          if (!last || !item) return resolve(Infinity);
          const [ax, ay] = centre(last);
          const [bx, by] = centre(item.getBoundingClientRect());
          resolve(Math.hypot(ax - bx, ay - by));
        };
        tick();
      }),
    [index, scrollMidFlight] as const,
  );
}

test("the kid view: a finishing tap shows the new thing big in the middle, then it flies into the scene", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  await page.getByRole("link", { name: "Open \u2068Mary\u2069's view" }).click();
  await expect(page).toHaveURL(/\/play$/);
  await page.getByRole("button", { name: /Tidy my toys/ }).click();
  await expect(page.getByText("1 star this week")).toBeAttached(); // said at once, for screen readers
  // Big and centred (about 70% of the width), springing in over the first half second.
  const reveal = page.locator("[data-reveal]");
  await expect(reveal).toHaveAttribute("data-phase", "show");
  await expect(reveal).toHaveAttribute("aria-hidden", "true");
  await expect(reveal).toContainText("🌸");
  await expect
    .poll(async () => {
      const box = await page.locator("[data-reveal-item]").boundingBox();
      if (!box) return false;
      const dx = Math.abs(box.x + box.width / 2 - 195);
      const dy = Math.abs(box.y + box.height / 2 - 422);
      return box.width >= 390 * 0.65 && dx < 20 && dy < 20;
    }, { timeout: 1000, intervals: [50] })
    .toBe(true);
  // The real one in the scene shows only once the big one has landed there, right on its spot.
  const item = page.locator('[data-item="0"]');
  await expect(item).toBeHidden();
  expect(await landingOffset(page, 0)).toBeLessThan(20);
  await expect(reveal).toHaveCount(0);
  await expect(item).toBeVisible();
  await expect(page.locator("[data-items]")).toHaveAttribute("data-items", "1");
});

// Records every frame what's big on screen: the reveal's emoji (once drawn) and the milestone's.
async function watchBig(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { big: { t: number; reveal: string | null; milestone: string | null }[] };
    w.big = [];
    const tick = (t: number) => {
      const reveal = document.querySelector("[data-reveal-glyph]")?.textContent ?? null;
      const milestone = document.querySelector("[data-milestone]")?.textContent ?? null;
      w.big.push({ t, reveal, milestone });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  // How long each one was on screen (first to last frame), in the order they showed, and whether two
  // were ever drawn at once.
  return async () => {
    const frames = await page.evaluate(() => (window as unknown as { big: { t: number; reveal: string | null; milestone: string | null }[] }).big);
    const shows: { what: string; from: number; to: number }[] = [];
    for (const f of frames) {
      const what = f.reveal ? `reveal ${f.reveal}` : f.milestone ? `milestone ${f.milestone}` : null;
      if (!what) continue;
      const last = shows.at(-1);
      if (last?.what === what) last.to = f.t;
      else shows.push({ what, from: f.t, to: f.t });
    }
    return { shows: shows.map((x) => ({ what: x.what, ms: x.to - x.from })), together: frames.some((f) => f.reveal && f.milestone) };
  };
}

test("the kid view: a 2×-a-day habit's first tap shows its new thing big in the middle too", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  await page.getByRole("link", { name: "Open \u2068Mary\u2069's view" }).click();
  await expect(page).toHaveURL(/\/play$/);
  await page.getByRole("button", { name: /Brush teeth/ }).click(); // 1 of 2: it earns a star
  await expect(page.getByText("1 star this week")).toBeAttached();
  const reveal = page.locator("[data-reveal]");
  await expect(reveal).toHaveAttribute("data-phase", "show");
  await expect(reveal).toContainText("🌸");
  await expect
    .poll(async () => {
      const box = await page.locator("[data-reveal-item]").boundingBox();
      if (!box) return false;
      return box.width >= 390 * 0.65 && Math.abs(box.x + box.width / 2 - 195) < 20 && Math.abs(box.y + box.height / 2 - 422) < 20;
    }, { timeout: 1500, intervals: [50] })
    .toBe(true);
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/reveal2-partial-tap.png` });
  // The card isn't done yet: it stays open, and the thing lands in the scene.
  await expect(page.getByRole("button", { name: "Brush teeth , done" })).toHaveCount(0);
  expect(await landingOffset(page, 0)).toBeLessThan(20);
  await expect(page.locator('[data-item="0"]')).toBeVisible();
});

test("the kid view: an undone card shows a big empty circle, and a 2×-a-day habit readable dots", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  await page.getByRole("link", { name: "Open \u2068Mary\u2069's view" }).click();
  await expect(page).toHaveURL(/\/play$/);
  const teeth = page.getByRole("button", { name: "Brush teeth" });
  // The place to tap: a big empty circle, sized for a small finger.
  const circle = teeth.locator('[data-mark="open"]');
  await expect(circle).toBeVisible();
  const c = (await circle.boundingBox())!;
  expect(c.width).toBeGreaterThanOrEqual(56);
  expect(c.height).toBeGreaterThanOrEqual(56);
  // 2× a day: two empty dots, each at least 20px.
  await expect(teeth.locator('[data-dot="empty"]')).toHaveCount(2);
  for (const dot of await teeth.locator("[data-dot]").all()) {
    const box = (await dot.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(20);
    expect(box.height).toBeGreaterThanOrEqual(20);
  }
  // The first tap fills one dot; the card stays open, its circle still empty.
  await teeth.click();
  await expect(teeth.locator('[data-dot="filled"]')).toHaveCount(1);
  await expect(teeth.locator('[data-dot="empty"]')).toHaveCount(1);
  await expect(teeth.locator('[data-mark="open"]')).toBeVisible();
  await page.waitForTimeout(2100); // past the double-tap guard
  await teeth.click();
  // Done: both dots filled, and the same circle holds the ✓.
  const done = page.getByRole("button", { name: "Brush teeth , done" });
  await expect(done.locator('[data-dot="filled"]')).toHaveCount(2);
  await expect(done.locator('[data-mark="done"]')).toBeVisible();
  // Same laid-out size as the empty circle. offsetWidth ignores transforms, so the done card's short
  // bounce (a scale animation, still running when measured) can't skew it the way boundingBox does.
  const openWidth = Math.round(c.width);
  const doneWidth = await done.locator('[data-mark="done"]').evaluate((el) => (el as HTMLElement).offsetWidth);
  expect(doneWidth).toBe(openWidth);
});

test("the kid view: a new-picture tap shows its new thing first, then the new picture, never both at once", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  await page.getByRole("link", { name: "Open \u2068Mary\u2069's view" }).click();
  await expect(page).toHaveURL(/\/play$/);
  await page.getByRole("button", { name: /Read a book together/ }).click();
  await page.getByRole("button", { name: /Tidy my toys/ }).click();
  await expect(page.locator('[data-item="1"]')).toBeVisible({ timeout: 5000 }); // both have landed
  await expect(page.locator("[data-reveal]")).toHaveCount(0);
  const seen = await watchBig(page);
  await page.getByRole("button", { name: /Brush teeth/ }).click(); // the third star: a sprout
  await expect(page.locator("[data-reveal]")).toContainText("🪻");
  if (process.env.SHOT_DIR) {
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${process.env.SHOT_DIR}/reveal2-milestone-1-item.png` });
  }
  await expect(page.locator("[data-milestone]")).toHaveText("🌱", { timeout: 4000 });
  if (process.env.SHOT_DIR) {
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${process.env.SHOT_DIR}/reveal2-milestone-2-picture.png` });
  }
  await expect(page.locator("[data-milestone]")).toHaveCount(0, { timeout: 4000 });
  const { shows, together } = await seen();
  expect(shows.map((x) => x.what)).toEqual(["reveal 🪻", "milestone 🌱"]);
  expect(shows[0].ms).toBeGreaterThan(1900); // the reveal plays in full first (2.1 s drawn)
  expect(together).toBe(false);
  await expect(page.getByRole("img", { name: "A sprout" })).toBeVisible();
  await expect(page.locator('[data-item="2"]')).toBeVisible();
});

test("the kid view: two taps 200 ms apart both show big, each long enough to see, and both cards sink after", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  await page.getByRole("link", { name: "Open \u2068Mary\u2069's view" }).click();
  await expect(page).toHaveURL(/\/play$/);
  const seen = await watchBig(page);
  await page.getByRole("button", { name: /Tidy my toys/ }).click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: /Read a book together/ }).click();
  // Both count at once; only the second picture waits its turn.
  await expect(page.getByText("2 stars this week")).toBeAttached();
  await expect(page.locator("[data-reveal]")).toContainText("🌸");
  await expect(page.locator("[data-reveal]")).toContainText("🍄", { timeout: 2000 });
  await expect(page.locator('[data-item="0"]')).toBeVisible();
  await expect(page.locator("[data-reveal]")).toHaveCount(0, { timeout: 4000 });
  await expect(page.locator('[data-item="1"]')).toBeVisible();
  await expect(page.locator("[data-items]")).toHaveAttribute("data-items", "2");
  const { shows } = await seen();
  expect(shows.map((x) => x.what)).toEqual(["reveal 🌸", "reveal 🍄"]);
  for (const x of shows) expect(x.ms).toBeGreaterThanOrEqual(700);
  // Both green cards go to the bottom once their things are in the picture.
  await expect(page.getByRole("listitem").first()).toContainText("Brush teeth", { timeout: 4000 });
});

test("the kid view with Reduce Motion: no zoom, the new thing fades in at its spot", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  await page.getByRole("link", { name: "Open \u2068Mary\u2069's view" }).click();
  await expect(page).toHaveURL(/\/play$/);
  await page.getByRole("button", { name: /Tidy my toys/ }).click();
  await expect(page.getByRole("button", { name: "Tidy my toys , done" })).toBeVisible();
  // It fades in right at its spot, with no overlay at any point.
  await expect(page.locator('[data-item="0"]')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.getAnimations().some((a) => a instanceof CSSAnimation && a.animationName === "item-fade")))
    .toBe(true);
  await page.waitForTimeout(300);
  await expect(page.locator("[data-reveal]")).toHaveCount(0);
  await expect(page.locator("[data-reveal-item]")).toHaveCount(0);
});

test("the kid view: the big reveal still lands on its spot when the picture shrinks mid-flight", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChildWithFiveHabits(page, "Family", "Mary");
  await page.getByRole("link", { name: "Open \u2068Mary\u2069's view" }).click();
  const cards = page.getByRole("listitem");
  await expect(cards).toHaveCount(5);
  const titles = (await cards.allInnerTexts()).map((t) => t.trim().split("\n").pop()!.trim());
  await cards.nth(titles.findIndex((t) => t !== "Brush teeth")).getByRole("button").click();
  await expect(page.locator("[data-reveal]")).toBeAttached();
  expect(await landingOffset(page, 0, true)).toBeLessThan(20);
  await expect(page.locator("[data-shrunk]")).toBeAttached();
  await expect(page.locator('[data-item="0"]')).toBeVisible();
});

test("a guardian opens a child's habit from the child page and deletes it when it has no check-ins", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  const kidUrl = page.url();
  const list = page.getByRole("region", { name: "Habits" });
  await list.getByRole("link", { name: /Tidy my toys/ }).click();
  await expect(page).toHaveURL(/\/habits\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Tidy my toys" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mary" })).toHaveAttribute("href", new URL(kidUrl).pathname);

  const manage = page.getByRole("region", { name: "Manage habit" });
  await expect(manage).toContainText("Edit details");
  await expect(manage).not.toContainText("Reminders");
  await expect(manage).toContainText("Archive"); // always offered (#168); Delete too while there are no check-ins
  await manage.getByText("Delete", { exact: true }).click();
  await manage.getByRole("button", { name: "Delete habit" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(kidUrl);
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(list).not.toContainText("Tidy my toys");
});

test("a guardian archives a child's habit that has a check-in, and it leaves the child page", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  const kidUrl = page.url();
  const list = page.getByRole("region", { name: "Habits" });
  await list.getByRole("button", { name: "Check in for \u2068Mary\u2069: \u2068Tidy my toys\u2069" }).click();
  await expect(list.getByRole("button", { name: "Done for \u2068Mary\u2069: \u2068Tidy my toys\u2069" })).toBeVisible();
  await list.getByRole("link", { name: /Tidy my toys/ }).click();
  await expect(page).toHaveURL(/\/habits\/[0-9a-f-]{36}$/);

  const manage = page.getByRole("region", { name: "Manage habit" });
  await expect(manage).not.toContainText("Delete");
  await manage.getByText("Archive", { exact: true }).click();
  await manage.getByRole("button", { name: "Archive habit" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Archive", exact: true }).click();
  await expect(page).toHaveURL(kidUrl);
  await expect(page.getByTestId("toast-live")).toHaveText("Archived \u2068Tidy my toys\u2069. Its history is in \u2068Mary\u2069's Archived.");
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(list).not.toContainText("Tidy my toys");
});

test("a child's own habit uses the same −/＋ count as yours, capped by the period", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  await page.getByRole("button", { name: "Add a habit" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Create your own" }).click();
  const own = page.getByRole("dialog", { name: "Your own habit for Mary" });
  await expect(own.getByLabel("Times")).toHaveValue("1");
  await expect(own.getByRole("button", { name: "Decrease" })).toBeDisabled();
  await own.getByRole("button", { name: "Increase" }).click();
  await own.getByRole("button", { name: "Increase" }).click();
  await expect(own.getByLabel("Times")).toHaveValue("3");
  await own.getByLabel("Per").selectOption("week");
  await own.getByLabel("Times").fill("7");
  await expect(own.getByRole("button", { name: "Increase" })).toBeDisabled();
  await own.getByLabel("Title").fill("Feed the fish");
  await own.getByRole("button", { name: "Add habit" }).click();
  await expect(own).toBeHidden();
  await expect(page.getByRole("region", { name: "Habits" })).toContainText("Feed the fish");
});

test("a guardian restores a child's archived habit from the child page", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  const kidUrl = page.url();
  const list = page.getByRole("region", { name: "Habits" });
  await list.getByRole("button", { name: "Check in for \u2068Mary\u2069: \u2068Tidy my toys\u2069" }).click();
  await expect(list.getByRole("button", { name: "Done for \u2068Mary\u2069: \u2068Tidy my toys\u2069" })).toBeVisible();
  await list.getByRole("link", { name: /Tidy my toys/ }).click();
  const manage = page.getByRole("region", { name: "Manage habit" });
  await manage.getByText("Archive", { exact: true }).click();
  await manage.getByRole("button", { name: "Archive habit" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Archive", exact: true }).click();
  await expect(page).toHaveURL(kidUrl);
  // Archived habits stay reachable from the child's page, and restore back into the list.
  await page.getByRole("region", { name: "Archived" }).getByRole("link", { name: /Tidy my toys/ }).click();
  await expect(page.getByRole("heading", { name: "Tidy my toys" })).toBeVisible();
  await page.getByRole("button", { name: "Restore \u2068Tidy my toys\u2069" }).click();
  await expect(page).toHaveURL(kidUrl);
  await expect(list.getByRole("listitem")).toHaveCount(3);
  await expect(list).toContainText("Tidy my toys");
  await expect(page.getByRole("region", { name: "Archived" })).toHaveCount(0);
});

test("editing a child's habit that has no category keeps it without one", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  await page.getByRole("region", { name: "Habits" }).getByRole("link", { name: /Tidy my toys/ }).click();
  const header = page.locator("header").filter({ hasText: "Tidy my toys" });
  await expect(header).not.toContainText("Home");
  const manage = page.getByRole("region", { name: "Manage habit" });
  await manage.getByText("Edit details", { exact: true }).click();
  await expect(manage.getByLabel("Category")).toHaveValue("");
  await expect(manage.getByLabel("Category").locator("option:checked")).toHaveText("None");
  await manage.getByLabel("Title").fill("Tidy my room");
  await manage.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("Saved");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tidy my room" })).toBeVisible();
  await expect(page.locator("header").filter({ hasText: "Tidy my room" })).not.toContainText("Home");
  await manage.getByText("Edit details", { exact: true }).click();
  await expect(manage.getByLabel("Category")).toHaveValue("");
});

test("a child's finished habit is listed under Finished, apart from Archived, with no Restore", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  const kidUrl = page.url();
  await page.getByRole("region", { name: "Habits" }).getByRole("link", { name: /Tidy my toys/ }).click();
  // A guardian sees the child's streak, not "your" streak.
  await expect(page.getByRole("region", { name: "Streaks" })).toContainText("Mary's streak");
  const habitUrl = page.url();
  endHabitYesterday(habitUrl.match(/\/habits\/([0-9a-f-]{36})/)![1]);
  await page.reload();
  const manage = page.getByRole("region", { name: "Manage habit" });
  await manage.getByText("Ends", { exact: true }).click();
  await manage.getByRole("button", { name: "Finish", exact: true }).click();
  // Wait for the answer, not the button: it says Finishing… while the request runs.
  await expect(page.getByTestId("toast-live")).toHaveText("\u2068Tidy my toys\u2069 is finished. Its history is in \u2068Mary\u2069's Finished.");
  await expect(page.locator("[data-toaster]").getByRole("link", { name: "Open \u2068Mary\u2069's page" })).toHaveAttribute("href", new URL(kidUrl).pathname);
  await expect(page.getByRole("region", { name: "Manage habit" })).toHaveCount(0);
  await page.goto(kidUrl);
  await expect(page.getByRole("region", { name: "Finished" })).toContainText("Tidy my toys");
  await expect(page.getByRole("region", { name: "Archived" })).toHaveCount(0);
  await page.getByRole("region", { name: "Finished" }).getByRole("link", { name: /Tidy my toys/ }).click();
  await expect(page.getByRole("heading", { name: "Tidy my toys" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Restore/ })).toHaveCount(0);
});

test("a child's data export has its own Data section, outside the danger zone", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  await expect(page.getByRole("region", { name: "Danger zone" }).getByRole("button", { name: /^Export/ })).toHaveCount(0);
  const download = page.waitForEvent("download");
  const data = page.getByRole("region", { name: "Data", exact: true });
  await data.getByRole("button", { name: "Export \u2068Mary\u2069's data" }).click();
  const file = (await download).suggestedFilename();
  expect(file).toMatch(/^keepup-Mary-\d{4}-\d{2}-\d{2}\.json$/);
  // It says which file it saved (a download can land unseen).
  await expect(data.getByRole("status")).toHaveText(`Downloaded ${file}.`);
});

test("the garden picture scrolls under the tab bar, never over it", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  await page.setViewportSize({ width: 412, height: 420 }); // short, so the page scrolls under the tab bar
  // The scene ignores the pointer; let it take hits here so elementFromPoint follows what's painted on top.
  await page.addStyleTag({ content: "[data-scene] * { pointer-events: auto !important; }" });
  const hero = page.getByRole("region", { name: "This week's garden" }).locator("[data-hero]");
  const nav = page.getByRole("navigation", { name: "Main" });
  // Scroll so the picture's big emoji sits in the middle of the tab bar.
  const [heroBox, navBox] = [await hero.boundingBox(), await nav.boundingBox()];
  if (!heroBox || !navBox) throw new Error("no layout");
  await page.mouse.wheel(0, heroBox.y + heroBox.height / 2 - (navBox.y + navBox.height / 2));
  await expect
    .poll(async () => {
      const box = await hero.boundingBox();
      if (!box) return false;
      return page.evaluate(
        ({ x, y }) => !!document.elementFromPoint(x, y)?.closest('nav[aria-label="Main"]'),
        { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      );
    })
    .toBe(true);
});

test("adding a child says what she starts with; deleting her goes back to Groups and says so", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  await expect(page.getByTestId("toast-live")).toHaveText("Added ⁨Mary⁩ with 3 habits. Each check-in earns 1 star.");

  const zone = page.getByRole("region", { name: "Danger zone" });
  await zone.getByRole("button", { name: "Delete ⁨Mary⁩'s profile" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete Mary's profile?" });
  // The POST is held, so the in-progress label can be seen.
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/kids/*", async (route) => {
    if (route.request().method() === "POST" && route.request().headers()["next-action"]) await held;
    await route.fallback();
  });
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Deleting…" })).toBeDisabled();
  release();
  await expect(page).toHaveURL(/\/groups$/);
  await expect(page.getByTestId("toast-live")).toHaveText("Deleted ⁨Mary⁩'s profile and history.");
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("the kid view at 320, 375, 414 and 430 wide: a long name is shown whole on one line, and the first card is big and on screen", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Alexandrina");
  const play = page.getByRole("main").getByRole("link", { name: "Open \u2068Alexandrina\u2069's view" });
  await play.click();
  await expect(page).toHaveURL(/\/play$/);
  for (const [width, height] of [[320, 640], [375, 812], [414, 896], [430, 932]] as const) {
    await page.setViewportSize({ width, height });
    await page.reload();
    const name = page.getByRole("heading", { name: "Alexandrina", level: 1 });
    await expect(name).toBeVisible();
    // Not cut short (it was "N…" beside Sound and Hold to exit), and on one line, not broken inside the word.
    expect(await name.evaluate((el) => el.scrollWidth <= el.clientWidth && getComputedStyle(el).textOverflow !== "ellipsis"), `${width}`).toBe(true);
    expect((await name.boundingBox())!.height, `${width}`).toBeLessThanOrEqual(40); // one 32 px line
    await expect(page.getByRole("button", { name: "Hold to exit \u2068Alexandrina\u2069's view" })).toBeInViewport();
    const first = page.getByRole("listitem").first().getByRole("button");
    await expect(first).toBeInViewport({ ratio: 1 });
    const box = (await first.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
});

test("the theme picker at 320: three tiles a row, each at least 44 px, names never broken inside a word", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  await page.setViewportSize({ width: 320, height: 640 });
  const tiles = page.getByRole("region", { name: "What grows" }).getByRole("group", { name: "Theme" }).getByRole("button");
  await expect(tiles).toHaveCount(5);
  const boxes = await Promise.all([0, 1, 2, 3, 4].map(async (i) => (await tiles.nth(i).boundingBox())!));
  for (const b of boxes) {
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
  }
  expect(boxes[1].y).toBe(boxes[0].y);
  expect(boxes[2].y).toBe(boxes[0].y);
  expect(boxes[3].y).toBeGreaterThan(boxes[0].y); // the fourth starts the second row
  // Names wrap between words only ("Garde/n" at 320 before): a word that didn't fit would overflow.
  for (let i = 0; i < 5; i++) {
    expect(await tiles.nth(i).evaluate((el) => getComputedStyle(el).overflowWrap === "normal" && el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  // The picked one is marked with more than colour.
  await expect(tiles.filter({ hasText: "Garden" })).toHaveAttribute("aria-pressed", "true");
});
