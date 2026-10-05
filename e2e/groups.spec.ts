import { expect, test } from "@playwright/test";
import { completeOnboarding, signUp, signUpAndOnboard, uniqueEmail } from "./helpers/auth";
import { addChild, createGroup, createGroupHabitVia, inviteLink, joinByLink, seedGroupMilestone, seedRecapWeek } from "./helpers/groups";
import { createHabit } from "./helpers/habits";

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

test("the member menu closes on Escape and on a tap outside", async ({ page, browser }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  const url = await inviteLink(page);
  const guest = await (await browser.newContext()).newPage();
  await joinByLink(guest, url, "Dan");
  await page.reload();
  const summary = page.getByLabel("Options for Dan");
  const makeAdmin = page.getByRole("button", { name: "Make admin" });
  await summary.click();
  await expect(makeAdmin).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(makeAdmin).toBeHidden();
  await expect(summary).toBeFocused();
  await summary.click();
  await expect(makeAdmin).toBeVisible();
  await page.getByRole("heading", { name: "Family", exact: true }).click();
  await expect(makeAdmin).toBeHidden();
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
  const welcome = guest.getByRole("main").getByRole("status");
  await expect(welcome).toContainText("Welcome to Family");
  await expect(welcome).toContainText("2 people · no group habits yet");
  await expect(welcome.getByRole("link", { name: "Open Family" })).toHaveAttribute("href", /^\/groups\/[0-9a-f-]{36}$/);

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
  await expect(friend.getByRole("main").getByRole("status")).toContainText("Welcome to Flatmates");
  // Already in: the link now offers Open, not Join.
  await friend.goto(url);
  await expect(friend.getByRole("button", { name: /^Join / })).toHaveCount(0);
  await friend.getByRole("link", { name: "Open Flatmates" }).click();
  await expect(friend).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);
});

test("Join on a page loaded before joining opens the group", async ({ page, browser }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Flatmates", "Roommates");
  const url = await inviteLink(page);
  const context = await browser.newContext();
  const friend = await context.newPage();
  await signUpAndOnboard(friend);
  await friend.goto(url);
  const otherTab = await context.newPage();
  await otherTab.goto(url);
  await otherTab.getByRole("button", { name: "Join Flatmates" }).click();
  await expect(otherTab).toHaveURL(/\/today\?joined=/);
  // The first tab still shows Join; tapping it now opens the group instead of the welcome card.
  await friend.getByRole("button", { name: "Join Flatmates" }).click();
  await expect(friend).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);
});

test("an admin opening their own link sees Open, not Join", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  const groupPath = new URL(page.url()).pathname;
  const url = await inviteLink(page);
  await page.goto(url);
  await expect(page.getByRole("button", { name: /^Join / })).toHaveCount(0);
  await page.getByRole("link", { name: "Open Family" }).click();
  await expect(page).toHaveURL((u) => u.pathname === groupPath);
});

test("a link turned off between the preview and the tap explains itself", async ({ page, browser }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Flatmates", "Roommates");
  const url = await inviteLink(page);
  const friend = await (await browser.newContext()).newPage();
  await signUpAndOnboard(friend);
  await friend.goto(url);
  await page.getByRole("button", { name: "Turn off link" }).click();
  await expect(page.getByRole("button", { name: "Create invite link" })).toBeVisible();
  await friend.getByRole("button", { name: "Join Flatmates" }).click();
  await expect(friend.getByRole("heading", { name: "This invite link doesn't work anymore" })).toBeVisible();
  await expect(friend.getByRole("main").getByRole("alert")).toHaveCount(0); // not an inline error
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
  // The first page must be listening before the guest's check-in lands (else Realtime drops it).
  // "ready" means the server confirmed the postgres_changes listener, which can take seconds under load.
  await expect(page.locator('[data-live="ready"]')).toBeAttached({ timeout: 20_000 });
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
  await expect(guest.getByRole("region", { name: "Streaks" })).toContainText("Together");
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
  await expect(page.getByRole("button", { name: /Date night/ })).toHaveCount(0); // for a couple group only
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
  await page.keyboard.press("Escape");

  // A couple group's Together tab offers Date night.
  await createGroup(page, "Us two", "Couple");
  await page.goto(`/habits/new?group=${page.url().match(/\/groups\/([0-9a-f-]{36})/)![1]}`);
  await expect(page.getByRole("button", { name: /Date night/ })).toBeVisible();
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
  // Let the approval land before leaving the page (a navigation can cut the action short).
  await expect(page.getByText("Nothing waiting for you.")).toBeVisible();
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
  // Unread says so in words, not only with a tint (read within MarkReadOnView's 1.5 s; Activity is
  // the default tab with no approvals).
  await expect(page.getByRole("listitem").filter({ hasText: /You've got this: Walk/ })).toContainText("Unread");
  // Tabs by keyboard: only the selected tab is in the Tab order; the arrows move and select.
  await expect(page.getByRole("tab", { name: "Activity" })).toHaveAttribute("tabindex", "0");
  await expect(page.getByRole("tab", { name: /^Approvals/ })).toHaveAttribute("tabindex", "-1");
  await page.getByRole("tab", { name: "Activity" }).focus();
  await page.keyboard.press("Home");
  await expect(page.getByRole("tab", { name: /^Approvals/ })).toBeFocused();
  await expect(page.getByRole("tab", { name: /^Approvals/ })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Activity" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText(/You've got this: Walk/)).toBeVisible();
  // After a moment on Activity, the rows shown count as read and the badge clears.
  await expect(page.getByRole("link", { name: "Inbox", exact: true })).toBeVisible();
});


test("after the first check-in, a family user gets one gentle Invite card, and can dismiss it", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await completeOnboarding(page, { purpose: "My family" });
  await createHabit(page, { template: "Drink water" });
  await expect(page.getByText("Invite your family")).toBeHidden();
  await page.getByRole("button", { name: "Check in: Drink water" }).click();
  await expect(page.getByRole("link", { name: "Drink water", exact: true })).toHaveAccessibleDescription(/1 \/ 8 today/);
  await page.reload();
  await expect(page.getByText("Invite your family")).toBeVisible();
  await expect(page.getByText("Invite a friend")).toBeHidden(); // one card at a time
  // The card hides at once and the dismissal is saved in the background: wait for it before reloading.
  const saved = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/today"));
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page.getByText("Invite your family")).toBeHidden();
  await saved;
  await page.reload();
  await expect(page.getByRole("link", { name: "Drink water", exact: true })).toHaveAccessibleDescription(/1 \/ 8 today/);
  await expect(page.getByText("Invite your family")).toBeHidden();
});

test("Invite a friend: one tap creates the group and opens its invite link", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await completeOnboarding(page, { purpose: "Friends" });
  await createHabit(page, { template: "Drink water" });
  await page.getByRole("button", { name: "Check in: Drink water" }).click();
  await expect(page.getByRole("link", { name: "Drink water", exact: true })).toHaveAccessibleDescription(/1 \/ 8 today/);
  await page.reload();
  await page.getByRole("button", { name: "Invite", exact: true }).click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}\?invite=1$/);
  await expect(page.getByRole("heading", { name: "Friends" })).toBeVisible();
  expect(await inviteLink(page)).toMatch(/\/invite\/[A-Za-z0-9_-]{24}$/);
  // With a group, the Invite card is done.
  await page.goto("/today");
  await expect(page.getByText("Invite a friend")).toBeHidden();
});

test("Everyone did it shows once, with confetti, then not again", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await createGroupHabitVia(page, "Family", "Family dinner");
  // After a second on screen, the card counts as seen: the markSeen action's POST, told apart from
  // the check-in's own POST by its argument (a list of ids, not one id).
  const seen = page.waitForResponse(
    (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/today" && /^\[\["/.test(r.request().postData() ?? ""),
    { timeout: 15_000 },
  );
  await page.getByRole("button", { name: "Check in: Family dinner" }).click();
  const card = page.getByText("Everyone did it! Family dinner ✓");
  await expect(card).toBeVisible();
  await expect(page.locator('[aria-hidden] > .animate-confetti')).toHaveCount(24);
  await seen;
  await page.reload();
  await expect(page.getByRole("button", { name: "Done: Family dinner" })).toBeVisible();
  await expect(card).toBeHidden();
});

test("a group milestone is an Inbox row, not a card on Today", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  const groupId = page.url().match(/\/groups\/([0-9a-f-]{36})/)![1];
  await createGroupHabitVia(page, "Family", "Family dinner");
  const href = await page.getByRole("link", { name: /Family dinner/ }).first().getAttribute("href");
  const habitId = href!.match(/\/habits\/([0-9a-f-]{36})/)![1];
  await seedGroupMilestone(groupId, habitId, 7, "day");
  await page.getByRole("button", { name: "Check in: Family dinner" }).click();
  await page.goto("/today");
  await expect(page.getByRole("button", { name: "Done: Family dinner" })).toBeVisible();
  await expect(page.getByText("🔥 Family dinner: 7 days in a row, together")).toHaveCount(0);
  // No milestone card any more, so no "milestone day" rule: the gentle card may show.
  await expect(page.getByText("Add a child? 🐼")).toBeVisible();
  await page.goto("/inbox");
  await page.getByRole("tab", { name: "Activity" }).click();
  await expect(page.getByText("🔥 Family dinner: 7 days in a row, together")).toBeVisible();
});

test("the weekly family recap tops the Inbox's Activity tab, not Today, and Dismiss sticks", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  const groupId = page.url().match(/\/groups\/([0-9a-f-]{36})/)![1];
  await createGroupHabitVia(page, "Family", "Family dinner");
  const href = await page.getByRole("link", { name: /Family dinner/ }).first().getAttribute("href");
  const habitId = href!.match(/\/habits\/([0-9a-f-]{36})/)![1];
  // family_recaps() runs on the database's clock: only on a day some time zone starts its week
  // (Sunday or Monday) can the group be made to start its week today.
  test.skip(!seedRecapWeek(groupId, habitId), "no time zone starts its week today (Sunday or Monday somewhere)");
  await page.goto("/today");
  await expect(page.getByRole("button", { name: /Family dinner/ }).first()).toBeVisible();
  await expect(page.getByText(/Together last week/)).toHaveCount(0);
  await page.goto("/inbox");
  await page.getByRole("tab", { name: "Activity" }).click();
  const recap = page.getByText(/^Together last week: 1 check-in/);
  await expect(recap).toBeVisible();
  await recap.locator("../..").getByRole("button", { name: "Dismiss" }).click();
  await expect(recap).toHaveCount(0);
  await page.waitForLoadState("networkidle"); // the dismissal has been saved
  await page.reload();
  await page.getByRole("tab", { name: "Activity" }).click();
  await expect(page.getByRole("tabpanel")).toBeVisible();
  await expect(page.getByText(/Together last week/)).toHaveCount(0); // server-rendered: there or not at once
});

test("with reduced motion, Everyone did it shows without confetti", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await createGroupHabitVia(page, "Family", "Family dinner");
  await page.getByRole("button", { name: "Check in: Family dinner" }).click();
  await expect(page.getByText("Everyone did it! Family dinner ✓")).toBeVisible();
  const confetti = page.locator('[aria-hidden] > .animate-confetti');
  await expect(confetti).toHaveCount(24);
  for (const piece of await confetti.all()) await expect(piece).toBeHidden();
});

test("Today's group header shows the group's avatar and opens the group", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  const groupPath = new URL(page.url()).pathname;
  await page.getByRole("button", { name: "Change the group avatar" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("group", { name: "Avatar" }).getByRole("button", { name: "🏡" }).click();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await createGroupHabitVia(page, "Family", "Family dinner");
  // The avatar is decoration inside the heading: the heading and its link are named "Family" only.
  const heading = page.getByRole("region", { name: "Family" }).getByRole("heading", { name: "Family", exact: true });
  await expect(heading).toContainText("🏡");
  await heading.getByRole("link", { name: "Family", exact: true }).click();
  await expect(page).toHaveURL((u) => u.pathname === groupPath);
});

test("the group page reads People, then Group habits, then Invite", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveText(["People", "Group habits", "Invite"]);
});
