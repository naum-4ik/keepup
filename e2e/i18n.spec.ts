import { expect, test } from "@playwright/test";

test("English pages say lang=en and ltr", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

test("a cookie for a language that isn't enabled falls back to English", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "locale", value: "xx", url: baseURL! }]);
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
