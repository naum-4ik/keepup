import { expect, test, type Page } from "@playwright/test";
import { completeOnboarding, signUp, signUpAndOnboard, uniqueEmail } from "./helpers/auth";
import { createGroup, createGroupHabitVia, inviteLink, joinByLink } from "./helpers/groups";
import { createHabit } from "./helpers/habits";

// Regression tests for the QA pass of 2026-09-30 (forms keep input, long names, dialog focus, …).

async function addChildUI(page: Page, name: string) {
  const groupId = page.url().match(/\/groups\/([0-9a-f-]{36})/)![1];
  await page.goto(`/kids/new?group=${groupId}`);
  await page.getByLabel("Nickname").fill(name);
  await page.getByLabel("I'm this child's parent or guardian").check();
  await page.getByRole("button", { name: `Add ${name}` }).click();
  await expect(page).toHaveURL(/\/kids\/[0-9a-f-]{36}$/);
}

// Sets an input's value the way typing does (the native setter + an input event), so React's state
// follows. A bare `el.value = …` is wiped by the next re-render of the form.
async function setValueLikeTyping(locator: import("@playwright/test").Locator, value: string) {
  await locator.evaluate((el: HTMLInputElement, v: string) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

test("kid custom habit: a server error keeps what was typed", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Fam");
  await addChildUI(page, "Mary");
  await page.getByRole("button", { name: "Add a habit" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Create your own" }).click();
  const own = page.getByRole("dialog", { name: "Your own habit for Mary" });
  await own.getByLabel("Title").fill("Swim");
  await own.getByLabel("Times").fill("8");
  await own.getByLabel("Per").selectOption("week");
  await own.getByRole("button", { name: "Add habit" }).click();
  await expect(own.getByRole("alert")).toHaveText("Pick 1–7 times a week.");
  await expect(own.getByLabel("Title")).toHaveValue("Swim");
  await expect(own.getByLabel("Times")).toHaveValue("8");
  await expect(own.getByLabel("Per")).toHaveValue("week");
  // Fixing the count is enough to add it.
  await own.getByLabel("Times").fill("2");
  await own.getByRole("button", { name: "Add habit" }).click();
  await expect(own).toBeHidden();
  await expect(page.getByText("Swim")).toBeVisible();
});

test("rename group: an error keeps what was typed, and the field stops at 40 characters", async ({ page }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Fam");
  await page.getByRole("button", { name: "Rename" }).click();
  const field = page.getByLabel("Group name");
  await expect(field).toHaveAttribute("maxlength", "40");
  await field.fill("   ");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Give the group a name." })).toBeVisible();
  await expect(field).toHaveValue("   ");
});

test("add child and new group: a server error keeps the box ticked and the kind picked", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/groups/new");
  await page.getByRole("radio", { name: "Friends" }).check();
  await page.getByLabel("Name").fill("A".repeat(45));
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page.getByText("Keep it to 40 characters.")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Friends" })).toBeChecked();

  await createGroup(page, "Fam");
  const groupId = page.url().match(/\/groups\/([0-9a-f-]{36})/)![1];
  await page.goto(`/kids/new?group=${groupId}`);
  await page.getByLabel("Nickname").fill("   ");
  const box = page.getByLabel("I'm this child's parent or guardian");
  await box.check();
  await page.getByRole("button", { name: /^Add / }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Enter a nickname." })).toBeVisible();
  await expect(box).toBeChecked();
  await expect(page.getByLabel("Nickname")).toHaveValue("   ");
});

test("closing Create your own and the avatar dialog gives focus back to the button", async ({ page }) => {
  await signUpAndOnboard(page);
  for (const [path, opener] of [["/habits/new", "Create your own"], ["/profile", "Change your avatar"]] as const) {
    await page.goto(path);
    const button = page.getByRole("button", { name: opener });
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(button).toBeFocused();
    await button.click();
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
    await expect(button).toBeFocused();
  }
});

test("long names without spaces don't make pages scroll sideways", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const long = "W".repeat(40);
  await signUp(page, uniqueEmail("long"));
  await completeOnboarding(page, { name: long });
  await createGroup(page, long);
  const groupPath = new URL(page.url()).pathname;
  const groupId = groupPath.split("/").pop()!;
  await inviteLink(page);
  await createGroupHabitVia(page, long, "W".repeat(60));
  await page.goto(`/kids/new?group=${groupId}`);
  await page.getByLabel("Nickname").fill(long);
  await page.getByLabel("I'm this child's parent or guardian").check();
  const noOverflow = async (where: string) => {
    const wide = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter((el) => !el.closest(".fixed") && (el.getBoundingClientRect().right > 391 || el.scrollWidth > el.clientWidth + 1) && getComputedStyle(el).overflowX === "visible")
        .map((el) => `${el.tagName} ${String((el as HTMLElement).className).slice(0, 60)} "${el.textContent?.slice(0, 20)}"`)
        .slice(0, 5),
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `${where}: ${wide.join(" | ")}`).toBeLessThanOrEqual(390);
  };
  await noOverflow("/kids/new");
  await page.getByRole("button", { name: /^Add / }).click();
  await expect(page).toHaveURL(/\/kids\/[0-9a-f-]{36}$/);
  const kidPath = new URL(page.url()).pathname;
  await page.goto("/today");
  const habitPath = (await page.locator('a[href^="/habits/"]:not([href="/habits/new"])').first().getAttribute("href"))!;
  for (const p of ["/today", "/progress", "/profile", "/groups", groupPath, kidPath, habitPath, "/inbox"]) {
    await page.goto(p);
    await noOverflow(p);
  }
});

test("a member who joins after the others checked in doesn't see Everyone did it", async ({ page, browser }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  const url = await inviteLink(page);
  await createGroupHabitVia(page, "Family", "Family dinner");
  await page.getByRole("button", { name: "Check in: Family dinner" }).click();
  await expect(page.getByRole("link", { name: /Family dinner/ })).toContainText("Everyone did it ✓");

  const guest = await (await browser.newContext()).newPage();
  await joinByLink(guest, url, "Dan");
  await guest.goto("/today");
  const card = guest.getByRole("link", { name: /Family dinner/ });
  await expect(card).toBeVisible();
  await expect(card).not.toContainText("Everyone did it");
  await expect(guest.getByRole("button", { name: "Check in: Family dinner" })).toBeVisible();
});

test("Times takes digits only: 1e1 is refused", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/habits/new");
  await page.getByRole("button", { name: "Create your own" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill("Push-ups");
  await dialog.getByLabel("Category").selectOption("fitness");
  // The stepper's input is type=number; "1e1" is a valid number string there, so set it directly.
  await setValueLikeTyping(dialog.locator('input[name="targetCount"]'), "1e1");
  await dialog.getByRole("button", { name: /^Add habit/ }).click();
  await expect(dialog.getByText(/^Pick 1–50 times a day\./)).toBeVisible();
});

test("an end before the start is refused, not dropped", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/habits/new");
  await page.getByRole("button", { name: "Create your own" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill("Stretch");
  await dialog.getByLabel("Category").selectOption("fitness");
  await dialog.getByRole("button", { name: "Until a date" }).click();
  // The date field's min stops this in the browser; the server must refuse it too.
  await setValueLikeTyping(dialog.locator('input[name="endsOn"]'), "2020-01-01");
  await dialog.getByRole("button", { name: /^Add habit/ }).click();
  await expect(dialog.getByRole("alert")).toHaveText("The last day can't be before the first day.");
  await expect(dialog.getByLabel("Title")).toHaveValue("Stretch");
});

test("the Inbox badge clears while the Inbox is open", async ({ page, browser }) => {
  await signUpAndOnboard(page);
  await createGroup(page, "Family");
  const url = await inviteLink(page);
  await createHabit(page, { title: "Walk", count: 1, period: "day" });
  await createGroupHabitVia(page, "Family", "Family dinner");
  const guest = await (await browser.newContext()).newPage();
  await joinByLink(guest, url, "Dan");
  await guest.goto("/today");
  await guest.getByRole("button", { name: "Check in: Family dinner" }).click();
  await expect(guest.getByRole("button", { name: "Done: Family dinner" })).toBeVisible();

  await page.goto("/today");
  await expect(page.getByRole("link", { name: /^Inbox, \d+ unread$/ })).toBeVisible();
  await page.goto("/inbox");
  await expect(page.getByRole("link", { name: "Inbox", exact: true })).toBeVisible({ timeout: 10_000 });
});

test("the 404 page shows the sprout and a way home", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("main").locator("svg")).toBeVisible();
  await page.getByRole("link", { name: "Back home" }).click();
  await expect(page).not.toHaveURL(/no-such-page/);
});
