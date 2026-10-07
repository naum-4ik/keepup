import { expect, test } from "@playwright/test";

// The banner and its Sign in come in the next task (M6 PR 3, task 3.2), with their own test.
test("Try it: a full account in under 5 seconds, with a check-in to approve", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("By continuing, you agree to the Privacy Policy")).toBeVisible();
  const started = Date.now();
  // The anonymous sign-in runs in the browser (each visitor's own IP against Supabase's per-IP limit).
  const signIn = page.waitForRequest((r) => r.method() === "POST" && r.url().includes("/auth/v1/signup"));
  await page.getByRole("button", { name: "Try it" }).click();
  await signIn;
  await expect(page.getByRole("button", { name: "Check in: Read", exact: true })).toBeVisible({ timeout: 5000 });
  expect(Date.now() - started).toBeLessThan(5000);
  await expect(page).toHaveURL(/\/today/);

  await page.goto("/inbox");
  // exact: "Approve" is also a substring of "Not approved".
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Nothing waiting for you.")).toBeVisible();
});
