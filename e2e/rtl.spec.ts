import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./helpers/auth";

const he = JSON.parse(readFileSync(join(process.cwd(), "supabase/functions/_shared/messages/he.json"), "utf8"));

// The back link's chevron on Settings. Tailwind v4's rtl:-scale-x-100 sets the CSS `scale` property
// (not `transform`), so that is what the tests read.
const backChevronScale = (page: Page) => page.locator("main svg.lucide-chevron-left").first().evaluate((el) => getComputedStyle(el).scale);

async function switchToHebrew(page: Page) {
  await page.goto("/profile/settings");
  await page.getByRole("radiogroup", { name: "Language" }).getByRole("radio", { name: he.settings.languageNames.he }).check();
  await expect(page.locator("html")).toHaveAttribute("lang", "he");
}

test("Hebrew: the page is right-to-left and nothing overflows sideways", async ({ page }) => {
  await signUpAndOnboard(page);
  await switchToHebrew(page);
  for (const path of ["/today", "/habits", "/progress", "/inbox", "/profile", "/profile/settings"]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("Hebrew: the back chevron is mirrored; in English it is not", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/profile/settings");
  expect(await backChevronScale(page)).toBe("none");
  await switchToHebrew(page);
  expect(await backChevronScale(page)).toBe("-1 1");
});
