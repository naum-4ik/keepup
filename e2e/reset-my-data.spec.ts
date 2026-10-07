import { expect, test } from "@playwright/test";
import { signUpAndOnboard } from "./helpers/auth";
import { createGroup, createGroupHabitVia } from "./helpers/groups";
import { countCheckIns, createHabit } from "./helpers/habits";

test("Settings → Reset my data: private habits, XP, badges and Inbox go; the group habit and the child stay", async ({ page, context }) => {
  test.setTimeout(90_000);
  await signUpAndOnboard(page);
  await createHabit(page, { title: "Walk", count: 1, period: "day" });
  await page.getByRole("button", { name: "Check in: Walk" }).click();
  await expect(page.getByRole("button", { name: "Done: Walk" })).toBeVisible();
  await createGroup(page, "Reset family");
  const groupId = page.url().match(/\/groups\/([0-9a-f-]{36})/)![1];
  // A child with her starter habits and a star (her data stays: she has Reset child).
  await page.getByRole("link", { name: "Add a child" }).click();
  await page.getByLabel("Nickname").fill("Mia");
  await page.getByRole("group", { name: "Avatar" }).getByRole("button", { name: "🐼" }).click();
  await page.getByLabel("I'm this child's parent or guardian").check();
  await page.getByRole("button", { name: "Add Mia" }).click();
  await expect(page).toHaveURL(/\/kids\/[0-9a-f-]{36}$/);
  await page.goto("/today");
  await page.getByRole("region", { name: /Mia/ }).getByRole("button", { name: "Check in for Mia: Tidy my toys" }).click();
  await expect(page.getByRole("region", { name: /Mia/ })).toContainText("⭐ 1");
  await createGroupHabitVia(page, "Reset family", "Family stretch");
  const groupHabit = page.getByRole("link", { name: /Family stretch/ });
  const groupHabitId = (await groupHabit.getAttribute("href"))!.split("/").pop()!;
  await page.getByRole("button", { name: "Check in: Family stretch" }).click();
  await expect(page.getByRole("button", { name: "Done: Family stretch" })).toBeVisible();
  // Before: XP and badges to clear (Planted, First step), and their Inbox rows.
  await page.goto("/profile/achievements");
  await expect(page.getByRole("region", { name: "Achievements" })).not.toContainText("0 of 24 earned");

  await page.goto("/profile/settings");
  const section = page.getByRole("region", { name: "Reset my data" });
  await expect(section).toContainText("your XP and level");
  await expect(section).toContainText("your check-ins in group habits");
  // Offline it says so, and nothing is cleared.
  await section.getByRole("button", { name: "Reset my data" }).click();
  const dialog = page.getByRole("dialog", { name: "Reset your data?" });
  const confirm = dialog.getByRole("button", { name: "Reset", exact: true });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Type “reset” to confirm").fill("rese");
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Type “reset” to confirm").fill("reset");
  await context.setOffline(true);
  await confirm.click();
  await expect(dialog.getByRole("alert")).toHaveText("Needs a connection");
  await context.setOffline(false);
  await confirm.click();

  // Today, with a calm note: the private habit is gone, the group habit stays with my check-in.
  const note = page.getByRole("status").filter({ hasText: "Your data is reset. A fresh start 🌱" });
  await expect(note).toBeVisible();
  await expect(note).toBeFocused(); // announced
  await expect(page).toHaveURL(/\/today$/); // said once: not again on reload
  await page.reload();
  await expect(page.getByText("Your data is reset.")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^Walk/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Done: Family stretch" })).toBeVisible();
  expect(countCheckIns(groupHabitId)).toBe(1);
  await expect(page.getByRole("region", { name: /Mia/ })).toContainText("⭐ 1");

  // XP 0 and level 1, no badges, an empty Inbox.
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Level 1 · Seedling" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Profile, level 1, 0% to level 2", exact: true })).toBeVisible();
  await page.goto("/profile/achievements");
  await expect(page.getByRole("region", { name: "Achievements" })).toContainText("0 of 24 earned");
  await page.goto("/inbox");
  await page.getByRole("tab", { name: "Activity" }).click();
  await expect(page.getByText("Nothing yet. Activity from your groups shows up here.")).toBeVisible();

  // The group and the child stay.
  await page.goto(`/groups/${groupId}`);
  await expect(page.getByRole("link", { name: /Mia/ }).first()).toBeVisible();
});
