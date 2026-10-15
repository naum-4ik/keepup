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

const loadedFaces = (page: import("@playwright/test").Page) =>
  page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family);
  });

test("English pages don't load the Cyrillic or Hebrew fonts", async ({ page }) => {
  await page.goto("/login");
  const faces = await loadedFaces(page);
  expect(faces.join(" ")).not.toMatch(/Cyrillic|Hebrew/i);
});

test("Russian and Hebrew text load their own fonts, not the Arial fallback", async ({ page }) => {
  await page.goto("/login");
  await page.evaluate(() => {
    const el = document.createElement("p");
    el.style.fontFamily = "var(--font-sans)";
    el.textContent = "Привет שלום";
    document.body.appendChild(el);
  });
  await expect.poll(async () => (await loadedFaces(page)).join(" ")).toMatch(/Cyrillic/i);
  expect((await loadedFaces(page)).join(" ")).toMatch(/Hebrew/i);
});
