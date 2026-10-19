import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { completeOnboarding, signIn, signUp, uniqueEmail } from "./helpers/auth";
import { createHabit } from "./helpers/habits";

// The Russian words come from the catalog, so a wording fix there doesn't break these tests.
const ru = JSON.parse(readFileSync(join(process.cwd(), "supabase/functions/_shared/messages/ru.json"), "utf8"));
const he = JSON.parse(readFileSync(join(process.cwd(), "supabase/functions/_shared/messages/he.json"), "utf8"));

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

test("English pages load only Nunito's basic Latin file, not latin-ext, Cyrillic or Hebrew", async ({ page }) => {
  for (const path of ["/", "/login"]) {
    await page.goto(path);
    const faces = (await loadedFaces(page)).join(" ");
    expect(faces).toMatch(/nunito/i);
    expect(faces).not.toMatch(/LatinExt|Cyrillic|Hebrew/i);
  }
});

test("a latin-ext name (Łukasz) loads Nunito's latin-ext file", async ({ page }) => {
  await page.goto("/login");
  await page.evaluate(() => {
    const el = document.createElement("p");
    el.style.fontFamily = "var(--font-sans)";
    el.textContent = "Łukasz Gülşen";
    document.body.appendChild(el);
  });
  await expect.poll(async () => (await loadedFaces(page)).join(" ")).toMatch(/LatinExt/i);
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

test("a locale=he cookie shows the sign-in screen in Hebrew, right to left", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "locale", value: "he", url: baseURL! }]);
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "he");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByText(he.auth.login.title, { exact: true })).toBeVisible();
  await page.getByLabel(he.auth.email).fill(uniqueEmail());
  await page.getByRole("button", { name: he.common.continue, exact: true }).click();
  await expect(page.getByRole("button", { name: he.auth.signIn, exact: true })).toBeVisible();
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

test("a template habit shows in the chosen language; a typed or renamed one stays as typed", async ({ page }) => {
  const en = { water: "Drink water", typed: "Morning swim", renamed: "Water before coffee" };
  const ruWater: string = ru.templates.water;
  await signUp(page, uniqueEmail());
  await completeOnboarding(page);
  await createHabit(page, { template: en.water });
  await createHabit(page, { title: en.typed, count: 1, period: "day" });
  // ru.settings.languageNames.en is "English" too: the radios name each language in itself.
  const language = async (name: string) => {
    await page.goto("/profile/settings");
    await page.getByRole("radio", { name, exact: true }).check();
    await expect(page.locator("html")).toHaveAttribute("lang", name === "English" ? "en" : "ru");
  };

  await language(ru.settings.languageNames.ru);
  await page.goto("/today");
  await expect(page.getByRole("link", { name: ruWater, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: en.typed, exact: true })).toBeVisible();
  await expect(page.getByText(en.water, { exact: true })).toHaveCount(0);

  // Editing something else, with the name left as shown (in Russian), keeps the template.
  await page.getByRole("link", { name: ruWater, exact: true }).click();
  await page.locator("summary").filter({ hasText: new RegExp(`^${ru.habits.detail.manage.edit.title}`) }).click();
  await expect(page.getByLabel(ru.habits.form.titleLabel, { exact: true })).toHaveValue(ruWater);
  await page.getByLabel(ru.habits.form.categoryLabel, { exact: true }).selectOption("fitness");
  await page.getByRole("button", { name: ru.common.save, exact: true }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(ru.common.saved);
  const habitUrl = page.url();
  await language("English");
  await page.goto(habitUrl);
  await expect(page.getByRole("heading", { name: en.water, exact: true })).toBeVisible();

  // Renamed: the typed name in both languages.
  await page.locator("summary").filter({ hasText: /^Edit details/ }).click();
  await page.getByLabel("Title", { exact: true }).fill(en.renamed);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("Saved");
  await expect(page.getByRole("heading", { name: en.renamed, exact: true })).toBeVisible();
  await language(ru.settings.languageNames.ru);
  await page.goto("/today");
  await expect(page.getByRole("link", { name: en.renamed, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: ruWater, exact: true })).toHaveCount(0);
});
