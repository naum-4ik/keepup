import { expect, test } from "@playwright/test";

const NOTICE = /Keepup has a new address/;

test("arriving with ?moved=1: a notice on every screen this session, until dismissed", async ({ page }) => {
  await page.goto("/?moved=1");
  const notice = page.getByRole("status").filter({ hasText: NOTICE });
  await expect(notice).toBeVisible();
  // Not left in the address bar, so it isn't bookmarked or shared.
  await expect(page).toHaveURL(/localhost:3000\/$/);

  // Survives a navigation once the param is gone.
  await page.getByRole("link", { name: "How?" }).click();
  await expect(page).toHaveURL(/\/install$/);
  await expect(page.getByRole("heading", { name: "Install Keepup", level: 1 })).toBeVisible();
  await expect(notice).toBeVisible();
  await page.goto("/login");
  await expect(notice).toBeVisible();

  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(notice).toHaveCount(0);
  await page.goto("/signup");
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(page.getByText(NOTICE)).toHaveCount(0);
});

test("Back from How to install returns to the landing page, without moved=1", async ({ page }) => {
  await page.goto("/?moved=1");
  await expect(page).toHaveURL(/localhost:3000\/$/);
  await page.getByRole("link", { name: "How?" }).click();
  await expect(page.getByRole("heading", { name: "Install Keepup", level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Keepup", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Install Keepup", level: 1 })).toHaveCount(0);
  await expect(page).toHaveURL(/localhost:3000\/$/);
});

test("no notice without ?moved=1", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(page.getByText(NOTICE)).toHaveCount(0);
});

test("the old icon opens /today signed out: the sign-in screen still shows the notice", async ({ page }) => {
  await page.goto("/today?moved=1");
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page).not.toHaveURL(/moved=1/);
  await expect(page.getByRole("status").filter({ hasText: NOTICE })).toBeVisible();
});

test("how to install is public and fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/install");
  await expect(page).toHaveURL(/\/install$/);
  await expect(page.getByRole("heading", { name: "Install Keepup", level: 1 })).toBeVisible();
  for (const name of ["iPhone and iPad", "Android", "Computer"]) {
    await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible();
  }
  await expect(page.getByText(/Turn on reminders/).first()).toBeVisible();
  // The drawings (docs/install): 4 iPhone, 3 Android, 1 computer, each described and loaded.
  const pictures = page.locator("main img");
  await expect(pictures).toHaveCount(8);
  for (const img of await pictures.all()) {
    await img.scrollIntoViewIfNeeded();
    await expect(img).toHaveAttribute("alt", /\S/);
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("a request to the old address forwards to the new one, path and query kept, with moved=1", async ({ request }) => {
  const res = await request.get("/login?next=%2Ftoday", {
    headers: { host: "keepup-murex.vercel.app" },
    maxRedirects: 0,
  });
  expect(res.status()).toBe(308);
  expect(res.headers()["location"]).toBe("https://keepuphabits.vercel.app/login?next=%2Ftoday&moved=1");
});

test("the new address is served as before", async ({ request }) => {
  const res = await request.get("/login", { maxRedirects: 0 });
  expect(res.status()).toBe(200);
});
