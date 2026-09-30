import { expect, type Page } from "@playwright/test";

export async function createGroup(page: Page, name: string, kind = "Family"): Promise<void> {
  await page.goto("/groups/new");
  await page.getByRole("radio", { name: kind }).check();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}/);
}

// The invite card shows the URL in a read-only input labelled "Invite link", so tests and people can select it.
export async function inviteLink(page: Page): Promise<string> {
  const link = page.getByRole("textbox", { name: "Invite link" });
  if (!(await link.isVisible())) await page.getByRole("button", { name: "Create invite link" }).click();
  return (await link.inputValue()).trim();
}
