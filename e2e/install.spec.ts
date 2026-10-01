import { expect, test } from "@playwright/test";

test("the manifest is served to signed-out visitors, with icons that load", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest", { maxRedirects: 0 });
  expect(res.status()).toBe(200);
  const manifest = await res.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toHaveLength(3);
  for (const icon of manifest.icons) expect((await request.get(icon.src)).status()).toBe(200);
});

test("pages link the manifest and the iPhone home-screen title", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", /\/manifest\.webmanifest/);
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "Keepup");
});
