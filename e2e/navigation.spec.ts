import { expect, test } from "@playwright/test";
import { signUpAndOnboard } from "./helpers/auth";

// page.route doesn't see requests a service worker answers: keep the worker out of this file.
test.use({ serviceWorkers: "block" });

test("a tapped tab answers before its page arrives, then the page shows", async ({ page }) => {
  await signUpAndOnboard(page);
  // Hold Progress's page data (the router's RSC requests, prefetch included) until we say so; everything
  // else goes through. Installed before Today loads, so no prefetch of Progress lands first.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(
    (url) => url.pathname === "/progress",
    async (route) => {
      if (route.request().headers()["rsc"] === "1") await held;
      // The router may have dropped a held prefetch once the navigation started: nothing left to continue.
      await route.continue().catch(() => {});
    },
  );
  await page.goto("/today");

  const tab = page.getByRole("navigation", { name: "Main", exact: true }).getByRole("link", { name: "Progress", exact: true });
  await tab.click();
  // While the server hasn't answered: the tapped tab is already marked (pending, or current once a loading
  // screen has committed), and the loading screen shows if it has.
  await expect(tab.locator("[data-pending]").or(page.locator('a[aria-current="page"][href="/progress"]'))).toBeVisible();
  await expect(page.getByRole("heading", { name: "Progress", level: 1 })).toHaveCount(0);

  release();
  await expect(page.getByRole("heading", { name: "Progress", level: 1 })).toBeVisible();
  await expect(tab).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("page-skeleton")).toHaveCount(0);
  await expect(tab.locator("[data-pending]")).toHaveCount(0);
});

test("a Progress tab (only the query changes) keeps the page up until the new list arrives: no loading screen", async ({ page }) => {
  await signUpAndOnboard(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  const isFinished = (url: URL) => url.pathname === "/progress" && url.searchParams.get("view") === "finished";
  await page.route(isFinished, async (route) => {
    if (route.request().headers()["rsc"] === "1") await held;
    await route.continue().catch(() => {});
  });
  await page.goto("/progress");
  const tabs = page.getByRole("navigation", { name: "Habit list" });
  const navigation = page.waitForRequest((r) => isFinished(new URL(r.url())) && r.headers()["rsc"] === "1" && !r.headers()["next-router-prefetch"]);
  await tabs.getByRole("link", { name: "Finished" }).click();
  await navigation;
  // The server hasn't answered: the same page, its tabs where they were, no skeleton.
  await expect(page.getByRole("heading", { name: "Progress", level: 1 })).toBeVisible();
  await expect(tabs.getByRole("link", { name: "Active" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("page-skeleton")).toHaveCount(0);

  release();
  await expect(tabs.getByRole("link", { name: "Finished" })).toHaveAttribute("aria-current", "page");
});
