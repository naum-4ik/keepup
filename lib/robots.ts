import type { MetadataRoute } from "next";

// Crawlers may read the public pages (/, /privacy, /terms, /install, /whats-new) and nothing behind a sign-in.
// "Allow: /" is a prefix match, so every app route is listed in Disallow. The sitemap (app/sitemap.ts)
// lists the public pages.
export const DISALLOWED = [
  "/today",
  "/progress",
  "/habits",
  "/groups",
  "/inbox",
  "/kids",
  "/profile",
  "/onboarding",
  "/login",
  "/signup",
  "/auth",
  "/invite",
  "/offline",
  "/api",
];

// Pages crawlers may read and the sitemap lists (paths; the sitemap makes them absolute).
export const PUBLIC_PAGES = ["/", "/install", "/privacy", "/terms", "/whats-new"];

export function robotsRules(siteUrl: string): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: DISALLOWED }, sitemap: `${siteUrl}/sitemap.xml` };
}

export function sitemapEntries(siteUrl: string): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.map((path) => ({ url: `${siteUrl}${path === "/" ? "" : path}` }));
}
