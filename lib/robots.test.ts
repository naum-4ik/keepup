import { describe, expect, it } from "vitest";
import { needsSignIn } from "./paths";
import { DISALLOWED, PUBLIC_PAGES, robotsRules, sitemapEntries } from "./robots";

const blocked = (path: string) => DISALLOWED.some((prefix) => path === prefix || path.startsWith(prefix));

describe("robots.txt", () => {
  it.each(["/", "/privacy", "/terms", "/install", "/whats-new"])("lets crawlers read %s", (p) => {
    expect(blocked(p)).toBe(false);
    expect(needsSignIn(p)).toBe(false);
  });

  it.each(["/today", "/progress/recaps", "/habits/new", "/groups", "/inbox", "/kids/abc", "/profile/settings", "/onboarding", "/login", "/signup", "/auth/callback", "/invite/abc", "/api/check-ins/tap"])(
    "keeps crawlers out of %s",
    (p) => {
      expect(blocked(p)).toBe(true);
    },
  );

  it("allows everything else, for every crawler, and points to the sitemap", () => {
    expect(robotsRules("https://keepuphabits.vercel.app")).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: DISALLOWED },
      sitemap: "https://keepuphabits.vercel.app/sitemap.xml",
    });
  });

  it("lists only pages crawlers may read in the sitemap, as absolute addresses", () => {
    const urls = sitemapEntries("https://keepuphabits.vercel.app").map((e) => e.url);
    expect(urls).toEqual([
      "https://keepuphabits.vercel.app",
      "https://keepuphabits.vercel.app/install",
      "https://keepuphabits.vercel.app/privacy",
      "https://keepuphabits.vercel.app/terms",
      "https://keepuphabits.vercel.app/whats-new",
    ]);
    for (const p of PUBLIC_PAGES) {
      expect(blocked(p)).toBe(false);
      expect(needsSignIn(p)).toBe(false);
    }
  });
});
