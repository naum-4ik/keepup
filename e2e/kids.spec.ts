import { expect, test, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./helpers/auth";
import { createGroup, createGroupHabitVia, inviteLink, joinByLink } from "./helpers/groups";
import { endHabitYesterday } from "./helpers/habits";

async function openGroup(page: Page, groupName: string) {
  await page.goto("/groups");
  await page.getByRole("link", { name: new RegExp(groupName) }).click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);
}

async function addChild(page: Page, groupName: string, name: string) {
  await openGroup(page, groupName);
  await page.getByRole("link", { name: "Add a child" }).click();
  await page.getByLabel("Nickname").fill(name);
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
  await mary.getByRole("button", { name: "Check in for Mary: Tidy my toys" }).click();
  await expect(mary).toContainText("⭐ 1");
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
  await expect(page.getByText("Add a child? 🐼")).toBeHidden(); // not before the first check-in
  await page.getByRole("button", { name: "Check in: Walk" }).click();
  await expect(page.getByRole("button", { name: "Done: Walk" })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Add a child? 🐼")).toBeVisible();
  await expect(page.getByText("Track brushing teeth, reading together and more.")).toBeVisible();
  await page.getByRole("link", { name: "Add a child", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/kids/new\\?group=${groupId}$`));
  await expect(page.getByLabel("Nickname")).toBeVisible();
});

test("the kid view: big buttons, a tap counts at once, and hold to exit", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  await page.getByRole("link", { name: "Open Mary's view" }).click();
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
  // Sound is on by default; the grown-up can mute it, and it's remembered on this phone.
  const sound = page.getByRole("button", { name: "Sound" });
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  await sound.click();
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(page.getByRole("button", { name: "Sound" })).toHaveAttribute("aria-pressed", "false");
  const exit = page.getByRole("button", { name: "Hold to exit Mary's view" });
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
});

test("Me + Mary checks in both in one tap", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  await page.goto("/habits/new");
  await page.getByRole("button", { name: "Create your own" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill("Walk the dog");
  await dialog.getByRole("radio", { name: "Family" }).check();
  await dialog.getByRole("switch", { name: "Include Mary" }).click();
  await dialog.getByRole("button", { name: /^Add habit/ }).click();
  await page.getByRole("button", { name: "Check in: Walk the dog" }).click();
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
  await dialog.getByRole("radio", { name: "Family" }).check();
  await dialog.getByRole("switch", { name: "Include Mary" }).click();
  await dialog.getByRole("button", { name: /^Add habit/ }).click();
  await page.getByRole("link", { name: /Walk the dog/ }).click();
  await expect(page).toHaveURL(/\/habits\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Check in: Walk the dog" }).click();
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
  await guest.getByRole("region", { name: /Mary/ }).getByRole("button", { name: "Check in for Mary: Tidy my toys" }).click();
  await expect(guest.getByRole("region", { name: /Mary/ })).toContainText("⭐ 1");
  await page.goto("/inbox");
  await page.getByRole("tab", { name: "Activity" }).click();
  await expect(page.getByText(/Dan logged Tidy my toys for Mary/)).toBeVisible();
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
  await expect(page.getByText("Feed the fish")).toBeVisible();
  await expect(page.getByText("Make my bed")).toBeVisible();
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
  await expect(goal).toContainText("Pizza night with grandma");
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
});

test("choose what grows with the child: the kid page and the kid view switch theme", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  const picker = page.getByRole("region", { name: "What grows" });
  await expect(picker.getByRole("button", { name: /Garden/ })).toHaveAttribute("aria-pressed", "true");
  await picker.getByRole("button", { name: /Aquarium/ }).click();
  await expect(picker.getByRole("button", { name: /Aquarium/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "This week's aquarium" })).toBeVisible();
  await page.reload(); // saved
  await expect(page.getByRole("region", { name: "What grows" }).getByRole("button", { name: /Aquarium/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Open Mary's view" }).click();
  await expect(page.getByRole("img", { name: "Clear water" })).toBeVisible();
});

test("reset a child's profile: export first is offered, and only the nickname and avatar stay", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  await expect(page.getByText("Brush teeth")).toBeVisible();
  const zone = page.getByRole("region", { name: "Danger zone" });
  await zone.getByRole("button", { name: "Reset Mary's profile" }).click();
  const dialog = page.getByRole("dialog", { name: "Reset Mary's profile?" });
  await expect(dialog).toContainText("Everything except Mary's nickname and avatar is cleared");
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export first" }).click();
  expect((await download).suggestedFilename()).toMatch(/^keepup-Mary-\d{4}-\d{2}-\d{2}\.json$/);
  await dialog.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(zone.getByRole("status")).toHaveText("Mary's profile is reset. A fresh start 🌱");
  await expect(page.getByText("No habits yet.")).toBeVisible();
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
  await dialog.getByRole("radio", { name: "Family" }).check();
  await dialog.getByRole("switch", { name: "Include Mary" }).click();
  await dialog.getByRole("button", { name: /^Add habit/ }).click();
  await expect(page).toHaveURL(/\/today$/);
  const mary = page.getByRole("region", { name: "Mary", exact: true });
  await expect(mary).toContainText("Walk the dog");
  const id = (await page.getByRole("link", { name: /Walk the dog/ }).first().getAttribute("href"))!.split("/").pop()!;

  endHabitYesterday(id);
  await page.reload();
  await expect(page.getByRole("region", { name: "Walk the dog is finished" })).toBeVisible();
  await expect(mary).not.toContainText("Walk the dog");
  await page.goto(kidPage);
  await expect(page.getByRole("region", { name: "Habits" })).toContainText("Tidy my toys");
  await expect(page.getByRole("region", { name: "Habits" })).not.toContainText("Walk the dog");
  await page.goto(`${kidPage}/play`);
  await expect(page.getByText("Tidy my toys")).toBeVisible();
  await expect(page.getByText("Walk the dog")).toHaveCount(0);

  await page.goto("/today");
  await page.getByRole("region", { name: "Walk the dog is finished" }).getByRole("button", { name: "Finish" }).click();
  await expect(page.getByRole("region", { name: "Walk the dog is finished" })).toBeHidden();
  await page.goto("/progress?view=finished");
  await page.getByRole("button", { name: "Start Walk the dog again" }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole("region", { name: "Mary", exact: true })).toContainText("Walk the dog");
});

test("the kid view: the third star brings the sprout, and the last habit of the day makes the scene dance", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  await page.getByRole("link", { name: "Open Mary's view" }).click();
  await expect(page).toHaveURL(/\/play$/); // the kid page shows the same picture: tap only in the kid view
  await expect(page.getByRole("img", { name: "A seed in the soil" })).toBeVisible();
  await page.getByRole("button", { name: /Read a book together/ }).click();
  await page.getByRole("button", { name: /Tidy my toys/ }).click();
  await page.getByRole("button", { name: /Brush teeth/ }).click();
  await expect(page.getByRole("img", { name: "A sprout" })).toBeVisible(); // 3 stars: the next picture
  // The new picture zooms in big over the screen for ~2 s, then settles into the scene.
  await expect(page.locator("[data-milestone]")).toHaveText("🌱");
  await expect(page.locator("[data-milestone]")).toHaveCount(0, { timeout: 4000 });
  await expect(page.locator("[data-items]")).toHaveAttribute("data-items", "3");
  await page.waitForTimeout(2100);
  await page.getByRole("button", { name: /Brush teeth/ }).click(); // the last one today
  await expect(page.locator("[data-items] .animate-dance").first()).toBeAttached();
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
  await page.getByRole("link", { name: "Open Mary's view" }).click();
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
  await expect(cards.last()).toContainText(title, { timeout: 2500 });
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
  await page.getByRole("link", { name: "Open Mary's view" }).click();
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
