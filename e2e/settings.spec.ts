import { expect, test } from "./fixtures";
import { signUpAndOnboard } from "./helpers/auth";

// Settings' one rule: every setting saves when it changes and says so beside it ("Saved ✓"); one
// that couldn't be saved goes back to the saved value with what to do. The typed name has its own Save.

for (const [width, height] of [[320, 640], [375, 812], [414, 896]] as const) {
  test(`Settings at ${width}×${height}: the first control and its Save are on screen above the nav, 44 px tall`, async ({ page }) => {
    await signUpAndOnboard(page);
    await page.setViewportSize({ width, height });
    await page.goto("/profile/settings");
    const name = page.getByLabel("Display name");
    const save = page.getByRole("region", { name: "Your profile" }).getByRole("button", { name: "Save", exact: true });
    const nav = (await page.getByRole("navigation", { name: "Main", exact: true }).boundingBox())!;
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    for (const control of [name, save]) {
      await expect(control).toBeInViewport({ ratio: 1 });
      const box = (await control.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.y + box.height).toBeLessThanOrEqual(nav.y);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
  });
}

test("a setting saves on change and says Saved ✓; offline it says what to do and keeps the saved one", async ({ page, context }) => {
  await signUpAndOnboard(page);
  await page.goto("/profile/settings");
  const week = page.getByLabel("Week starts on");
  const saved = await week.inputValue();
  const other = saved === "1" ? "0" : "1";

  await context.setOffline(true);
  await week.selectOption(other);
  await expect(page.getByRole("region", { name: "Your profile" }).getByRole("alert")).toHaveText("Not saved: no connection. Connect and pick it again.");
  await expect(week).toHaveValue(saved); // back to what is saved, not silently
  await context.setOffline(false);

  await week.selectOption(other);
  await expect(page.getByRole("region", { name: "Your profile" }).getByRole("status").filter({ hasText: "Saved ✓" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Your profile" }).getByRole("alert")).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Week starts on")).toHaveValue(other);
});

test("Celebrations saves on change and says Saved ✓ under it", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/profile/settings");
  const section = page.getByRole("region", { name: "Celebrations", exact: true });
  const group = section.getByRole("radiogroup", { name: "Celebrations" });
  const next = (await group.getByRole("radio", { name: "Full" }).isChecked()) ? "Subtle" : "Full";
  await group.getByRole("radio", { name: next }).check();
  await expect(section.getByRole("status")).toHaveText("Saved ✓");
  await page.reload();
  await expect(page.getByRole("radiogroup", { name: "Celebrations" }).getByRole("radio", { name: next })).toBeChecked();
});
