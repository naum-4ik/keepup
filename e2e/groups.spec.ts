import { expect, test } from "@playwright/test";
import { signUpAndOnboard } from "./helpers/auth";
import { createGroup, inviteLink } from "./helpers/groups";

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

test("pick an avatar in settings and see it in the header", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/profile/settings");
  await page.getByText("Your avatar").click();
  await page.getByRole("group", { name: "Avatar" }).getByRole("button", { name: "🦊" }).click();
  await page.getByRole("button", { name: "sky" }).click();
  await page.getByRole("button", { name: "Save" }).last().click();
  // The header avatar and the nav's Profile tab are both "Profile" links; the header is the banner.
  await expect(page.getByRole("banner").getByRole("link", { name: "Profile" })).toContainText("🦊");
});
