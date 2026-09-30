import { expect, test, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./helpers/auth";
import { createGroup, createGroupHabitVia, inviteLink, joinByLink } from "./helpers/groups";

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
  await expect(page.getByRole("img", { name: "3 more stars to a sprout" })).toBeVisible();
  await expect(page.getByText("3 more ⭐ to 🌱")).toBeVisible(); // written out for the grown-up
  await expect(page.getByText(/^A new garden starts on \w+day 🌱$/)).toBeVisible(); // the family's first day of the week
  await page.getByRole("button", { name: /Brush teeth/ }).click();
  await expect(page.getByText("1 star this week")).toBeAttached(); // for screen readers; the path is the visible count
  await expect(page.getByRole("img", { name: "2 more stars to a sprout" })).toBeVisible(); // the path fills
  const exit = page.getByRole("button", { name: "Hold to exit Mary's view" });
  await exit.click(); // a quick tap does nothing
  await expect(page).toHaveURL(/\/play$/);
  await exit.hover();
  await page.mouse.down();
  await page.waitForTimeout(1700);
  await page.mouse.up();
  await expect(page).toHaveURL(/\/kids\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Mary did it")).toBeVisible();
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
  await expect(page.getByRole("img", { name: "3 more stars to seaweed" })).toBeVisible();
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

