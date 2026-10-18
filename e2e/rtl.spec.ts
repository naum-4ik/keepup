import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./helpers/auth";

const he = JSON.parse(readFileSync(join(process.cwd(), "supabase/functions/_shared/messages/he.json"), "utf8"));

// The back link's chevron on Settings. Tailwind v4's rtl:-scale-x-100 sets the CSS `scale` property
// (not `transform`), so that is what the tests read.
const backChevronScale = (page: Page) => page.locator('main a[href="/profile"] svg').first().evaluate((el) => getComputedStyle(el).scale);

async function switchToHebrew(page: Page) {
  await page.goto("/profile/settings");
  await page.getByRole("radiogroup", { name: "Language" }).getByRole("radio", { name: he.settings.languageNames.he }).check();
  await expect(page.locator("html")).toHaveAttribute("lang", "he");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
}

test("Hebrew: the page is right-to-left and nothing overflows sideways", async ({ page }) => {
  await signUpAndOnboard(page);
  await switchToHebrew(page);
  for (const path of ["/today", "/habits", "/progress", "/inbox", "/profile", "/profile/settings"]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
    // scrollWidth misses content spilling past the start (left) edge in RTL: check every visible box.
    const spill = await page.evaluate(() => {
      const w = window.innerWidth;
      // Inside a horizontal scroller or clipping box (carousels, truncated text) sideways content is not spill.
      const clipped = (el: Element) => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).overflowX !== "visible") return true;
        return false;
      };
      return [...document.querySelectorAll("body *")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden" && !el.closest(".sr-only") && !clipped(el);
        })
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.left < -1 || r.right > w + 1;
        })
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.getAttribute("class") ?? "").slice(0, 40)}`)
        .slice(0, 5);
    });
    expect(spill, `${path}: elements outside the viewport`).toEqual([]);
  }
});

test("Hebrew: the back chevron is mirrored; in English it is not", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/profile/settings");
  expect(await backChevronScale(page)).toBe("none");
  await switchToHebrew(page);
  await expect.poll(() => backChevronScale(page)).toMatch(/^-1\b/);
});
