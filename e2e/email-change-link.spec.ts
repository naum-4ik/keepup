import { expect, test } from "./fixtures";
import { completeOnboarding, signUp, uniqueEmail } from "./helpers/auth";
import { localAdmin } from "./helpers/groups";

// What Keepup's email_change template links to (supabase/templates/email_change.html).
test("a token-hash email-change link is accepted on another device, and works once", async ({ page, browser }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await completeOnboarding(page);

  const { url, key } = localAdmin();
  const res = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "email_change_current", email, new_email: uniqueEmail("moved") }),
  });
  expect(res.ok, await res.clone().text()).toBe(true);
  const { hashed_token } = (await res.json()) as { hashed_token: string };

  const link = `/auth/confirm?token_hash=${hashed_token}&type=email_change&next=/profile/settings`;
  const phone = await browser.newContext();
  const phonePage = await phone.newPage();
  await phonePage.goto(link);
  await expect(phonePage).not.toHaveURL(/\/auth\/error/);
  await expect(phonePage).toHaveURL(/\/(profile\/settings|login)/);
  await phone.close();

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto(link);
  await expect(otherPage).toHaveURL(/\/auth\/error\?reason=link$/);
  await other.close();
});
