import { expect, test, type Page } from "./fixtures";

// axe-core on the key screens: every WCAG 2.x A/AA rule and axe's best practices, except colour
// contrast (checked once by hand in #282, and it depends on the theme). Any violation fails, with the
// rule, its impact and the elements in the message. 375 wide: the narrow phone the layout targets.
test.use({ viewport: { width: 375, height: 812 } });

const AXE = "node_modules/axe-core/axe.min.js";

type Violation = { id: string; impact: string | null; help: string; nodes: { target: string[] }[] };

async function expectNoViolations(page: Page, screen: string): Promise<void> {
  await page.addScriptTag({ path: AXE });
  const violations = await page.evaluate(async () => {
    // @ts-expect-error axe is the global the script tag adds.
    const result = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
      rules: { "color-contrast": { enabled: false } },
      resultTypes: ["violations"],
    });
    return result.violations.map((v: Violation) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => ({ target: n.target })) }));
  });
  const report = violations.map((v: Violation) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.map((n) => n.target.join(" ")).join("\n    ")}`);
  expect(report, `${screen}: axe violations`).toEqual([]);
}

async function visit(page: Page, screen: string, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expectNoViolations(page, screen);
}

test("signed-out screens have no axe violations", async ({ page }) => {
  for (const [screen, path] of [
    ["landing", "/"],
    ["login", "/login"],
    ["signup", "/signup"],
    ["install", "/install"],
    ["privacy", "/privacy"],
    ["terms", "/terms"],
  ] as const) {
    await visit(page, screen, path);
  }
});

// One demo session for all of them: each Try it spends one of the local anonymous sign-ins.
test("demo screens, a kid's page and the kid view have no axe violations", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try a demo with sample habits" }).click();
  await expect(page.getByRole("button", { name: /^Check in: / }).first()).toBeVisible({ timeout: 15_000 });
  // A fresh load, so the fixture waits until every streamed section (groups, kids) is in place.
  await page.goto("/today");
  await expect(page.getByRole("region", { name: "Nova" })).toBeVisible();
  await expectNoViolations(page, "today");

  const habit = await page.getByRole("link", { name: "Drink water" }).getAttribute("href");
  const group = await page.getByRole("heading", { name: "Family" }).getByRole("link").getAttribute("href");
  const kid = await page.locator('a[href^="/kids/"]').first().getAttribute("href");

  await visit(page, "progress", "/progress");
  await visit(page, "habit", habit!);
  await visit(page, "groups", "/groups");
  await visit(page, "group", group!);
  await visit(page, "inbox", "/inbox");
  await visit(page, "profile", "/profile");
  await visit(page, "settings", "/profile/settings");
  await visit(page, "kid page", kid!);

  await page.goto(`${kid}/play`);
  await expect(page.getByRole("button", { name: /^Hold to exit/ })).toBeVisible();
  await expectNoViolations(page, "kid view");
});
