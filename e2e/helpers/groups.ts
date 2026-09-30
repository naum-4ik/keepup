import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
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

// Children can't be added from the UI until Task 10; add one straight into the local database with
// the service role (local stack only).
function localAdmin(): { url: string; key: string } {
  const raw = execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  // The CLI may print notices before the JSON (see scripts/local-env.mjs).
  const status = JSON.parse(raw.slice(raw.indexOf("{")));
  const url: string = status.API_URL;
  // Never send the service-role key anywhere but the local stack.
  const host = new URL(url).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") throw new Error(`Refusing to use the service role on ${url}`);
  return { url, key: status.SERVICE_ROLE_KEY };
}

export async function addChild(groupId: string, name: string): Promise<void> {
  const { url, key } = localAdmin();
  const res = await fetch(`${url}/rest/v1/profiles`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: randomUUID(), display_name: name, kind: "child", group_id: groupId }),
  });
  expect(res.ok, await res.text()).toBe(true);
}
