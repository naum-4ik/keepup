import { expect, test } from "@playwright/test";
import { signUpAndOnboard } from "./helpers/auth";
import { addChild, createGroup, inviteLink } from "./helpers/groups";

test("create a group, get an invite link, rename it, and see it in Groups", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.getByRole("link", { name: "Groups" }).click();
  await expect(page.getByText("Share habits with the people you live and hang out with.")).toBeVisible();
  await createGroup(page, "Levi family");
  const url = await inviteLink(page);
  expect(url).toMatch(/\/invite\/[A-Za-z0-9_-]{24}$/);
  expect(await inviteLink(page)).toBe(url); // reused, not a new token
  await page.getByRole("button", { name: "Rename" }).click();
  await page.getByLabel("Group name").fill("The Levis");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "The Levis" })).toBeVisible();
  await page.goto("/groups");
  await expect(page.getByRole("link", { name: /The Levis/ })).toContainText("1 member");
});

test("the only member deletes their group", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Book club", "Friends");
  await page.getByRole("button", { name: "Delete group" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete group" }).click();
  await expect(page).toHaveURL(/\/groups$/);
  await expect(page.getByText("Book club")).toBeHidden();
});

test("deleting a group with a child asks again, and Cancel resets that step", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Levi family");
  const groupId = page.url().match(/\/groups\/([0-9a-f-]{36})/)![1];
  await addChild(groupId, "Mary");
  await page.reload();
  const dialog = page.getByRole("dialog");

  await page.getByRole("button", { name: "Delete group" }).click();
  await dialog.getByRole("button", { name: "Delete group" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Mary's profile and history will be deleted.");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  // Reopening starts over: the warning is gone and the confirm button isn't armed.
  await page.getByRole("button", { name: "Delete group" }).click();
  await expect(dialog.getByRole("alert")).toBeHidden();
  await expect(dialog.getByRole("button", { name: "Delete anyway" })).toBeHidden();
  await dialog.getByRole("button", { name: "Delete group" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Mary's profile and history will be deleted.");
  await dialog.getByRole("button", { name: "Delete anyway" }).click();
  await expect(page).toHaveURL(/\/groups$/);
  await expect(page.getByText("Levi family")).toBeHidden();
});

test("pick an avatar in settings and see it in the header", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/profile/settings");
  await page.getByText("Your avatar").click();
  await page.getByRole("group", { name: "Avatar" }).getByRole("button", { name: "🦊" }).click();
  await page.getByRole("button", { name: "Sky", exact: true }).click();
  await page.getByRole("button", { name: "Save" }).last().click();
  // The header avatar and the nav's Profile tab are both "Profile" links; the header is the banner.
  await expect(page.getByRole("banner").getByRole("link", { name: "Profile" })).toContainText("🦊");
});
