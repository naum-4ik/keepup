import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { completeOnboarding, signIn, signUp, uniqueEmail } from "./helpers/auth";

// The Russian words come from the catalog, so a wording fix there doesn't break these tests.
const ru = JSON.parse(readFileSync(join(process.cwd(), "supabase/functions/_shared/messages/ru.json"), "utf8"));

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

test("a locale=ru cookie shows the sign-in screen in Russian", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "locale", value: "ru", url: baseURL! }]);
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByText(ru.auth.login.title, { exact: true })).toBeVisible();
  await page.getByLabel(ru.auth.email).fill(uniqueEmail());
  await page.getByRole("button", { name: ru.common.continue, exact: true }).click();
  await expect(page.getByRole("button", { name: ru.auth.signIn, exact: true })).toBeVisible();
});

test("Settings → Language → Русский switches the app, and the profile carries it to a new browser", async ({ page, browser }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await completeOnboarding(page);

  await page.goto("/profile/settings");
  await page.getByRole("radiogroup", { name: "Language" }).getByRole("radio", { name: ru.settings.languageNames.ru }).check();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.getByRole("heading", { name: ru.settings.title, exact: true })).toBeVisible();

  // A fresh context has no locale cookie: after sign-in the profile's language wins.
  const other = await browser.newContext({ baseURL: "http://localhost:3000", timezoneId: "Europe/Rome" });
  const page2 = await other.newPage();
  await signIn(page2, email);
  await expect(page2).toHaveURL(/\/today$/);
  await expect(page2.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page2.getByRole("heading", { name: ru.today.title, exact: true })).toBeVisible();
  await other.close();
});
