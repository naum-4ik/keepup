import { expect, test, type Page } from "./fixtures";

// No broken links: crawl the app the way a visitor clicks around, signed out from the start page and
// signed in to the demo, following same-origin links. A page fails if it answers 4xx/5xx, or shows
// the not-found or error page (a streamed page can call notFound() after its 200 has gone out).
// Pictures and icons on each page get a status check. External links aren't followed (a site being
// down shouldn't fail the suite). Runs in the full e2e after each merge, not in PR checks.

const NOT_FOUND = "Page not found";
const ERROR = "Something went wrong";
// Ids differ per page (/habits/<uuid>): a couple of each kind is enough.
const PER_ROUTE = 2;
const MAX_PAGES = 60;

// Links that change something, or that aren't pages.
function skip(url: URL): boolean {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") || // route handlers: callback, confirm, account-gone (signs out)
    url.pathname.startsWith("/_next/") ||
    url.searchParams.has("demo") ||
    /sign-?out|log-?out|delete|reset/i.test(url.pathname)
  );
}

const route = (url: URL) =>
  url.pathname.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id").replace(/\/[A-Za-z0-9_-]{20,}(?=\/|$)/g, "/:token") +
  [...url.searchParams.keys()].sort().join("&");

type Found = { links: string[]; assets: string[] };
const collect = (page: Page) =>
  page.evaluate((): Found => {
    const links = [...document.querySelectorAll<HTMLAnchorElement>("a[href]")]
      .filter((a) => !a.hasAttribute("download") && !/sign out|log out/i.test(a.textContent ?? ""))
      .map((a) => a.href);
    const assets = [
      ...[...document.querySelectorAll<HTMLImageElement>("img[src]")].map((i) => i.currentSrc || i.src),
      ...[...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]')].map((l) => l.href),
    ];
    return { links, assets };
  });

async function crawl(page: Page, start: string[]): Promise<{ visited: string[]; problems: string[] }> {
  const origin = new URL(page.url()).origin;
  const queue: { href: string; from?: string }[] = start.map((href) => ({ href }));
  const seen = new Set<string>();
  const perRoute = new Map<string, number>();
  const assetsChecked = new Set<string>();
  const visited: string[] = [];
  const problems: string[] = [];

  while (queue.length && visited.length < MAX_PAGES) {
    const { href: target, from } = queue.shift()!;
    const url = new URL(target, origin);
    url.hash = "";
    const key = url.pathname + url.search;
    if (seen.has(key)) continue;
    seen.add(key);
    if (url.origin !== origin || skip(url)) continue;
    const kind = route(url);
    if ((perRoute.get(kind) ?? 0) >= PER_ROUTE) continue;
    perRoute.set(kind, (perRoute.get(kind) ?? 0) + 1);

    const res = await page.goto(key);
    visited.push(key);
    // Until the loading screen gives way, the page has neither its links nor its not-found heading.
    await expect(page.getByTestId("page-skeleton")).toHaveCount(0, { timeout: 10_000 });
    const where = from ? `${key} (linked from ${from})` : key;
    const status = res?.status() ?? 0;
    if (status >= 400) {
      problems.push(`${where}: ${status}`);
      continue;
    }
    for (const [text, what] of [
      [NOT_FOUND, "not-found page"],
      [ERROR, "error page"],
    ]) {
      if (await page.getByRole("heading", { name: text, level: 1 }).count()) problems.push(`${where}: ${what}`);
    }
    // Where it landed (a redirect, e.g. a signed-in visitor sent from /login to /today).
    const landed = new URL(page.url());
    seen.add(landed.pathname + landed.search);

    const { links, assets } = await collect(page);
    for (const link of links) queue.push({ href: link, from: landed.pathname });
    for (const asset of assets) {
      const a = new URL(asset, origin);
      if (a.origin !== origin || a.protocol === "data:" || assetsChecked.has(a.href)) continue;
      assetsChecked.add(a.href);
      const r = await page.request.get(a.href);
      if (r.status() >= 400) problems.push(`${a.pathname}${a.search} (on ${landed.pathname}): ${r.status()}`);
    }
  }
  return { visited, problems };
}

test.describe("links", () => {
  test.setTimeout(90_000);

  test("signed out: every page linked from the start page opens", async ({ page }) => {
    await page.goto("/");
    const { visited, problems } = await crawl(page, ["/", "/login", "/signup", "/install", "/privacy", "/terms", "/whats-new"]);
    expect(problems).toEqual([]);
    expect(visited.length).toBeGreaterThan(5);
  });

  // One demo sign-in (anonymous sign-ins are limited per IP: see demo.spec.ts).
  test("in the demo: every page the app links to opens", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Try a demo with sample habits" }).click();
    await expect(page).toHaveURL(/\/today/, { timeout: 15_000 });
    const { visited, problems } = await crawl(page, ["/today"]);
    expect(problems).toEqual([]);
    // Reached only by following links: a crawl that read a page too early would stop short of them.
    const kinds = new Set(visited.map((v) => route(new URL(v, "http://x"))));
    for (const kind of ["/progress/recaps", "/progress/calendar", "/profile/settings", "/profile/achievements", "/habits/:id", "/groups/:id", "/kids/:id/play"]) {
      expect(kinds, kind).toContain(kind);
    }
  });
});
