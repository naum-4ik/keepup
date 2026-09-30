import { expect, test } from "@playwright/test";
import { completeOnboarding, signUp, signUpAndOnboard, uniqueEmail } from "./helpers/auth";
import { addChild, createGroup, createGroupHabitVia, inviteLink, joinByLink } from "./helpers/groups";

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

test("tap your avatar on Profile to change it, and see it in the header", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/profile/settings");
  await expect(page.getByText("Your avatar")).toHaveCount(0); // moved to Profile
  await page.goto("/profile");
  await page.getByRole("button", { name: "Change your avatar" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("group", { name: "Avatar" }).getByRole("button", { name: "🦊" }).click();
  await dialog.getByRole("button", { name: "Sky", exact: true }).click();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden(); // closes once saved
  // The header avatar and the nav's Profile tab are both "Profile" links; the header is the banner.
  await expect(page.getByRole("banner").getByRole("link", { name: "Profile" })).toContainText("🦊");
  await expect(page.getByRole("button", { name: "Change your avatar" })).toContainText("🦊");
});

test("a group gets an avatar on creation, admins change it, members only see it", async ({ page, browser }) => {
  await signUpAndOnboard(page);
  await page.goto("/groups/new");
  await page.getByLabel("Name").fill("Pizza night");
  await page.getByRole("group", { name: "Avatar" }).getByRole("button", { name: "🍕" }).click();
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}/);
  await expect(page.getByRole("button", { name: "Change the group avatar" })).toContainText("🍕");

  await page.getByRole("button", { name: "Change the group avatar" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("group", { name: "Avatar" }).getByRole("button", { name: "🏡" }).click();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Change the group avatar" })).toContainText("🏡");
  const url = await inviteLink(page);
  await page.goto("/groups");
  await expect(page.getByRole("link", { name: /Pizza night/ })).toContainText("🏡");

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await joinByLink(guest, url, "Dan");
  await guest.goto("/groups");
  await guest.getByRole("link", { name: /Pizza night/ }).click();
  await expect(guest.getByRole("img", { name: "Pizza night" })).toContainText("🏡");
  await expect(guest.getByRole("button", { name: "Change the group avatar" })).toHaveCount(0);
  await guestContext.close();
});

test("an invited person joins from the link and lands on the group's habits", async ({ page, browser }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  const url = await inviteLink(page);

  const guest = await (await browser.newContext()).newPage();
  await guest.goto(url);
  await expect(guest.getByRole("heading", { name: /invited you to Family/ })).toBeVisible();
  await expect(guest.getByText("1 person is already in Family.")).toBeVisible();
  // Google is off on the local stack, so email is the main button ("Use email instead" next to
  // "Join with Google" when it's on).
  await guest.getByRole("link", { name: "Continue with email" }).click();
  await expect(guest).toHaveURL(/\/login\?next=%2Finvite%2F/);
  await guest.getByRole("link", { name: "Sign up" }).click();
  await expect(guest).toHaveURL(/\/signup\?next=%2Finvite%2F/);
  await signUp(guest, uniqueEmail("guest"), { startOnSignupPage: true });
  await expect(guest).toHaveURL(/\/invite\//);
  await guest.getByRole("button", { name: "Join Family" }).click();
  await expect(guest).toHaveURL(/\/onboarding\?joined=/);
  await expect(guest.getByText("You're joining Family. A little about you first.")).toBeVisible();
  await expect(guest.getByText("Keepup is for")).toBeHidden();
  await completeOnboarding(guest, { name: "Grandma", invited: true });
  await expect(guest.getByRole("status")).toContainText("You joined Family ✓");

  await page.goto("/groups");
  await expect(page.getByRole("link", { name: /Family/ })).toContainText("2 members");
});

test("someone already using Keepup joins with one tap", async ({ page, browser }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Flatmates", "Roommates");
  const url = await inviteLink(page);

  const friend = await (await browser.newContext()).newPage();
  await signUpAndOnboard(friend);
  await friend.goto(url);
  await friend.getByRole("button", { name: "Join Flatmates" }).click();
  await expect(friend).toHaveURL(/\/today\?joined=/);
  await expect(friend.getByRole("status")).toContainText("You joined Flatmates ✓");
});

test("an expired or revoked link explains itself", async ({ page }) => {
  await page.goto("/invite/not-a-real-token-at-all-xx");
  await expect(page.getByRole("heading", { name: "This invite link doesn't work anymore" })).toBeVisible();
  await expect(page.getByText("Ask the person who sent it for a new one.")).toBeVisible();
});

test("a group habit: both check in, both see Everyone did it, live", async ({ page, browser }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  const url = await inviteLink(page);
  const guest = await (await browser.newContext()).newPage();
  await joinByLink(guest, url, "Dan");

  await page.goto("/habits/new");
  await page.getByRole("button", { name: "Create your own" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill("Family dinner");
  await dialog.getByRole("radio", { name: "Family" }).check();
  await dialog.getByRole("button", { name: /^Add habit/ }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole("region", { name: "Family" })).toBeVisible();

  await page.getByRole("button", { name: "Check in: Family dinner" }).click();
  await expect(page.getByRole("button", { name: "Done: Family dinner" })).toBeVisible();
  await guest.goto("/today");
  await expect(guest.getByRole("img", { name: /: done$/ })).toBeVisible(); // Ana's avatar shows done, no names in text
  await guest.getByRole("button", { name: "Check in: Family dinner" }).click();
  await expect(guest.getByText("Everyone did it ✓")).toBeVisible();
  // The first browser updates without a reload (Realtime → router.refresh()).
  await expect(page.getByText("Everyone did it ✓")).toBeVisible({ timeout: 10_000 });
});

test("a member pauses just themselves; the habit carries on for the others", async ({ page, browser }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  const url = await inviteLink(page);
  const guest = await (await browser.newContext()).newPage();
  await joinByLink(guest, url, "Dan");
  await createGroupHabitVia(page, "Family", "Walk");
  await guest.goto("/today");
  await guest.getByRole("link", { name: /Walk/ }).click();
  // Members don't manage the habit itself.
  await expect(guest.getByText("Pause for everyone")).toBeHidden();
  await expect(guest.getByText("Edit details")).toBeHidden();
  await guest.getByText("Pause just me").click();
  await guest.getByRole("button", { name: "Pause" }).click();
  await expect(guest.getByRole("button", { name: "Paused: Walk" })).toBeVisible();
  await page.goto("/today");
  await expect(page.getByRole("button", { name: "Check in: Walk" })).toBeEnabled();
});

test("Together templates show only when adding from a group, and never offer Just me", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Levi family");
  const groupUrl = page.url();
  const groupId = groupUrl.match(/\/groups\/([0-9a-f-]{36})/)![1];
  const dialog = page.getByRole("dialog");

  // From the plus button: no Together tab, Popular first, Just me stays.
  await page.goto("/habits/new");
  await expect(page.getByRole("tab", { name: "Together" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Popular" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: /Drink water/ }).click();
  await expect(dialog.getByRole("radio", { name: "Just me" })).toBeChecked();
  await expect(dialog.getByRole("radio", { name: "Levi family" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // From the group: Together is there and selected; its templates are group-only.
  await page.goto(`/habits/new?group=${groupId}`);
  await expect(page.getByRole("tab", { name: "Together" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: /Family dinner/ }).click();
  await expect(dialog.getByRole("radio", { name: "Just me" })).toHaveCount(0);
  await expect(dialog.getByRole("radio", { name: "Levi family" })).toBeChecked();
  await page.setViewportSize({ width: 390, height: 844 });
  if (process.env.SHOT_DIR) await page.waitForTimeout(600); // let the open animation finish
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/fix-together-dialog.png` });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // A Popular template from the group screen keeps Just me and preselects the group.
  await page.getByRole("tab", { name: "Popular" }).click();
  await page.getByRole("button", { name: /Drink water/ }).click();
  await expect(dialog.getByRole("radio", { name: "Just me" })).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "Levi family" })).toBeChecked();
});

test("approval: check-ins wait, each approves the other in the Inbox, both see Everyone did it", async ({ page, browser }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Gym buddies", "Friends");
  const url = await inviteLink(page);
  const guest = await (await browser.newContext()).newPage();
  await joinByLink(guest, url, "Dan");

  await page.goto("/habits/new");
  await page.getByRole("button", { name: "Create your own" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill("Gym");
  await dialog.getByRole("radio", { name: "Gym buddies" }).check();
  await dialog.getByRole("switch", { name: "Needs approval" }).click();
  await dialog.getByRole("button", { name: /^Add habit/ }).click();

  await page.getByRole("button", { name: "Check in: Gym" }).click();
  await expect(page.getByRole("button", { name: "Waiting for approval: Gym" })).toBeVisible();
  await guest.goto("/today");
  await guest.getByRole("button", { name: "Check in: Gym" }).click();
  await expect(guest.getByRole("link", { name: /check-in waiting for you/ })).toBeVisible();

  await guest.getByRole("link", { name: /Inbox/ }).click();
  // exact: "Approve" is also a substring of "Not approved".
  await guest.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(guest.getByText("Nothing waiting for you.")).toBeVisible();

  await page.goto("/inbox");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.goto("/today");
  await expect(page.getByText("Everyone did it ✓")).toBeVisible();
  await guest.goto("/today");
  await expect(guest.getByText("Everyone did it ✓")).toBeVisible();
  await guest.getByRole("link", { name: /Inbox/ }).click();
  await guest.getByRole("tab", { name: "Activity" }).click();
  await expect(guest.getByText("Everyone did it: Gym ✓")).toBeVisible();
});

test("nudge a member with a preset, and they see it in their Inbox", async ({ page, browser }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  const url = await inviteLink(page);
  const guest = await (await browser.newContext()).newPage();
  await joinByLink(guest, url, "Dan");
  await createGroupHabitVia(page, "Family", "Walk");
  // A new member isn't required in the period they joined, so nudge from Dan to Anna instead: Anna was there from the start.
  await guest.goto("/today");
  await guest.getByRole("link", { name: /Walk/ }).click();
  await guest.getByRole("button", { name: /^Nudge/ }).click();
  await guest.getByRole("menuitem", { name: "💪 You've got this" }).click();
  await expect(guest.getByRole("button", { name: "Nudged ✓" })).toBeDisabled();
  await page.goto("/inbox");
  await page.getByRole("tab", { name: "Activity" }).click();
  await expect(page.getByText(/You've got this: Walk/)).toBeVisible();
  // After a moment on Activity, the rows shown count as read and the badge clears.
  await expect(page.getByRole("link", { name: "Inbox", exact: true })).toBeVisible();
});

