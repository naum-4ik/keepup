import { expect, test, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./helpers/auth";
import { createGroup, inviteLink, joinByLink } from "./helpers/groups";

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

test("the kid view: big buttons, a tap counts at once, and hold to exit", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await addChild(page, "Family", "Mary");
  await page.getByRole("link", { name: "Open Mary's view" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
  await page.getByRole("button", { name: /Brush teeth/ }).click();
  await expect(page.getByText("⭐ 1")).toBeVisible();
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
  await expect(goal.getByRole("button", { name: /Stay up late/ })).toHaveCount(0); // six ideas first
  await goal.getByRole("button", { name: "More ideas" }).click();
  await expect(goal.getByRole("button", { name: /Stay up late/ })).toBeVisible();
  await goal.getByRole("button", { name: /Pizza night/ }).click();
  await expect(goal.getByLabel("Treat", { exact: true })).toHaveValue("Pizza night");
  await expect(goal.getByRole("group", { name: "Treat emoji" }).getByRole("button", { name: "🍕" })).toHaveAttribute("aria-pressed", "true");
  await goal.getByLabel("Treat", { exact: true }).fill("Pizza night with grandma"); // an idea can be edited
  await goal.getByRole("button", { name: "⭐ 30" }).click();
  await expect(goal.getByLabel("Stars")).toHaveValue("30");
  await goal.getByRole("button", { name: "Set goal" }).click();
  await expect(goal).toContainText("Pizza night with grandma");
  await expect(goal).toContainText("⭐ 0 of 30");
});

